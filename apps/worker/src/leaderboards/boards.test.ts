import { randomUUID } from "node:crypto";
import { applyMigrations, attempts, challenges, challengeVersions, connect, dailyChallenges, sql, users, userSkills, xpLedger } from "@greenbuild/db";
import { type AttemptFinished, isoWeek, leaderboardKeys, utcDay } from "@greenbuild/shared";
import { type Container, startContainer } from "@greenbuild/testkit";
import { createClient } from "redis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recordDailyTime, syncSkillBoards, syncWeeklyXp } from "./boards.js";

// architecture.md, "Лидерборды" (task 45a): the worker keeps the plan's Redis sorted sets.
const DAY_MS = 86_400_000;
let containers: Container[] = [];
let database: ReturnType<typeof connect>;
let redis: ReturnType<typeof createClient>;

beforeAll(async () => {
  const pg = await startContainer({
    image: "postgres:16-alpine",
    port: 5432,
    env: { POSTGRES_PASSWORD: "test" },
    ready: async (address) => {
      const probe = connect(`postgres://postgres:test@${address}/postgres`);
      await probe.db.execute(sql`select 1`).finally(() => probe.close());
    },
  });
  const rd = await startContainer({
    image: "redis:8-alpine",
    port: 6379,
    ready: async (address) => {
      const probe = createClient({ url: `redis://${address}` });
      probe.on("error", () => undefined);
      await probe.connect();
      await probe.close();
    },
  });
  containers = [pg, rd];
  const url = `postgres://postgres:test@${pg.address}/postgres`;
  await applyMigrations(url);
  database = connect(url);
  redis = createClient({ url: `redis://${rd.address}` });
  await redis.connect();
}, 120_000);

afterAll(async () => {
  await redis?.close();
  await database?.close();
  await Promise.all(containers.map((container) => container.stop()));
});

function deps(): { db: typeof database.db; boards: typeof redis; logs: null } {
  return { db: database.db, boards: redis, logs: null };
}

async function aUser(country: string | null = null): Promise<string> {
  const [user] = await database.db.insert(users).values({ country }).returning();
  return user?.id ?? "";
}

async function anAttempt(userId: string, options: { durationMs: number; context: "daily" | "catalog"; versionId?: string }): Promise<{ attemptId: string; versionId: string }> {
  let versionId = options.versionId;
  if (!versionId) {
    const [challenge] = await database.db.insert(challenges).values({ slug: `c-${randomUUID()}`, title: "C", difficulty: 3 }).returning();
    const [version] = await database.db
      .insert(challengeVersions)
      .values({ challengeId: challenge?.id ?? "", version: 1, specJson: {}, imageRef: "img", checkerHash: "sha256:x", source: "human" })
      .returning();
    versionId = version?.id ?? "";
  }
  const [attempt] = await database.db
    .insert(attempts)
    .values({ userId, challengeVersionId: versionId, seed: 1, context: options.context, status: "solved", durationMs: options.durationMs })
    .returning();
  return { attemptId: attempt?.id ?? "", versionId };
}

function solved(userId: string, attemptId: string): AttemptFinished {
  return { version: 1, attempt_id: attemptId, user_id: userId, challenge_version_id: randomUUID(), status: "solved", checks_used: 1, finished_at: new Date().toISOString() };
}

describe("syncWeeklyXp", () => {
  it("sets this week's XP on the global and the country board, the same when run again", async () => {
    const userId = await aUser("KZ");
    const { attemptId } = await anAttempt(userId, { durationMs: 1, context: "catalog" });
    await database.db.insert(xpLedger).values([
      { userId, attemptId, reason: "solve", amount: 120 },
      { userId, attemptId, reason: "new_skills", amount: 50, createdAt: new Date(Date.now() - 8 * DAY_MS) },
    ]);
    const week = isoWeek(new Date());

    await syncWeeklyXp(deps(), userId, new Date());
    await syncWeeklyXp(deps(), userId, new Date());
    expect(await redis.zScore(leaderboardKeys.globalWeekly(week), userId)).toBe(120);
    expect(await redis.zScore(leaderboardKeys.countryWeekly("KZ", week), userId)).toBe(120);
  });
});

describe("syncSkillBoards", () => {
  it("sets each skill rating on its board", async () => {
    const userId = await aUser();
    await database.db.insert(userSkills).values([
      { userId, skill: "linux", rating: 1612.5 },
      { userId, skill: "nginx", rating: 1480 },
    ]);

    await syncSkillBoards(deps(), userId);
    expect(await redis.zScore(leaderboardKeys.skill("linux"), userId)).toBe(1612.5);
    expect(await redis.zScore(leaderboardKeys.skill("nginx"), userId)).toBe(1480);
  });
});

describe("recordDailyTime", () => {
  it("keeps the player's best time for today's daily challenge, and skips other challenges", async () => {
    const userId = await aUser();
    const first = await anAttempt(userId, { durationMs: 90_000, context: "daily" });
    const today = utcDay(new Date());
    await database.db.insert(dailyChallenges).values({ day: today, track: "linux", challengeVersionId: first.versionId });
    const slower = await anAttempt(userId, { durationMs: 120_000, context: "daily", versionId: first.versionId });
    const elsewhere = await anAttempt(await aUser(), { durationMs: 1_000, context: "catalog" });
    const board = leaderboardKeys.daily(today, "linux");

    await recordDailyTime(deps(), solved(userId, first.attemptId));
    await recordDailyTime(deps(), solved(userId, slower.attemptId));
    await recordDailyTime(deps(), solved(randomUUID(), elsewhere.attemptId));
    expect(await redis.zRangeWithScores(board, 0, -1)).toEqual([{ value: userId, score: 90_000 }]);
  });
});
