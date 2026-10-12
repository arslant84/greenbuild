import { randomUUID } from "node:crypto";
import { applyMigrations, attempts, challenges, challengeVersions, cheatReviews, connect, eq, sql, streaks, users } from "@greenbuild/db";
import type { AttemptFinished } from "@greenbuild/shared";
import { type Container, startContainer } from "@greenbuild/testkit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { countStreak } from "./count.js";

// architecture.md, "Стрики" (task 44): the worker counts solves per calendar day in the player's timezone.
let container: Container;
let database: ReturnType<typeof connect>;

beforeAll(async () => {
  container = await startContainer({
    image: "postgres:16-alpine",
    port: 5432,
    env: { POSTGRES_PASSWORD: "test" },
    ready: async (address) => {
      const probe = connect(`postgres://postgres:test@${address}/postgres`);
      await probe.db.execute(sql`select 1`).finally(() => probe.close());
    },
  });
  const url = `postgres://postgres:test@${container.address}/postgres`;
  await applyMigrations(url);
  database = connect(url);
}, 120_000);

afterAll(async () => {
  await database?.close();
  await container?.stop();
});

async function aUser(timezone = "UTC"): Promise<string> {
  const [user] = await database.db.insert(users).values({ timezone }).returning();
  return user?.id ?? "";
}

function solvedAt(userId: string, finishedAt: string, status: AttemptFinished["status"] = "solved"): AttemptFinished {
  return { version: 1, attempt_id: randomUUID(), user_id: userId, challenge_version_id: randomUUID(), status, checks_used: 1, finished_at: finishedAt };
}

// storedSolve is a solved attempt kept in the database, as the streak is counted again from them.
async function storedSolve(userId: string, finishedAt: string): Promise<AttemptFinished> {
  const [challenge] = await database.db.insert(challenges).values({ slug: `c-${randomUUID()}`, title: "C", difficulty: 3 }).returning();
  const [version] = await database.db
    .insert(challengeVersions)
    .values({ challengeId: challenge?.id ?? "", version: 1, specJson: {}, imageRef: "img", checkerHash: "sha256:x", source: "human" })
    .returning();
  const values = { userId, challengeVersionId: version?.id ?? "", seed: 1, context: "catalog" as const, status: "solved" as const, finishedAt: new Date(finishedAt) };
  const [attempt] = await database.db.insert(attempts).values(values).returning();
  return { ...solvedAt(userId, finishedAt), attempt_id: attempt?.id ?? "", challenge_version_id: values.challengeVersionId };
}

async function streakOf(userId: string): Promise<{ current: number; lastDay: string | null } | undefined> {
  const [row] = await database.db.select({ current: streaks.current, lastDay: streaks.lastDay }).from(streaks).where(eq(streaks.userId, userId));
  return row;
}

describe("countStreak", () => {
  it("grows on consecutive days and counts a day once, even for a repeated event", async () => {
    const userId = await aUser();
    const first = solvedAt(userId, "2026-11-01T10:00:00Z");

    await countStreak(database.db, first);
    await countStreak(database.db, first);
    await countStreak(database.db, solvedAt(userId, "2026-11-01T18:00:00Z"));
    await countStreak(database.db, solvedAt(userId, "2026-11-02T09:00:00Z"));
    expect(await streakOf(userId)).toEqual({ current: 2, lastDay: "2026-11-02" });
  });

  it("uses the player's timezone for the day", async () => {
    const userId = await aUser("Asia/Almaty");

    await countStreak(database.db, solvedAt(userId, "2026-11-01T22:30:00Z"));
    expect(await streakOf(userId)).toEqual({ current: 1, lastDay: "2026-11-02" });
  });

  it("counts the streak again without a solve a review voided", async () => {
    const userId = await aUser();
    const days = [];
    for (const finishedAt of ["2026-11-01T10:00:00Z", "2026-11-02T10:00:00Z", "2026-11-03T10:00:00Z"]) {
      days.push(await storedSolve(userId, finishedAt));
      await countStreak(database.db, days.at(-1) as AttemptFinished);
    }
    expect(await streakOf(userId)).toEqual({ current: 3, lastDay: "2026-11-03" });

    const voided = days[1] as AttemptFinished;
    await database.db.insert(cheatReviews).values({ attemptId: voided.attempt_id, reviewerId: await aUser(), decision: "void" });
    await countStreak(database.db, voided);
    expect(await streakOf(userId)).toEqual({ current: 1, lastDay: "2026-11-03" });
  });

  it("ignores attempts that were not solved", async () => {
    const userId = await aUser();

    await countStreak(database.db, solvedAt(userId, "2026-11-01T10:00:00Z", "failed"));
    expect(await streakOf(userId)).toBeUndefined();
  });
});
