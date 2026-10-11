import { randomUUID } from "node:crypto";
import { applyMigrations, attempts, challenges, challengeVersions, connect, eq, sql, users, userSkills } from "@greenbuild/db";
import { type AttemptFinished, GLICKO_INITIAL_RATING, GLICKO_INITIAL_RATING_DEVIATION, GLICKO_INITIAL_VOLATILITY, QUEUE_PAYLOAD_FIELD, STREAM_ATTEMPT_FINISHED, updateRating } from "@greenbuild/shared";
import { type Container, startContainer } from "@greenbuild/testkit";
import { createClient } from "redis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consumeFinishedBatch } from "../finished-consumer.js";
import { rateAttempt, ratingHandler } from "./rate.js";

// architecture.md, "Рейтинг навыка" (task 43b): each finished attempt is one Glicko-2 game between the
// player and the challenge version; skills move by their manifest weights.
const START = { rating: GLICKO_INITIAL_RATING, deviation: GLICKO_INITIAL_RATING_DEVIATION, volatility: GLICKO_INITIAL_VOLATILITY };
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

interface Finished {
  status: "solved" | "failed";
  started?: boolean;
  flagged?: boolean;
}

async function aUser(): Promise<string> {
  const [user] = await database.db.insert(users).values({}).returning();
  return user?.id ?? "";
}

// aVersion is a starting-rated challenge version testing linux (0.8) and nginx (0.2).
async function aVersion(): Promise<string> {
  const [challenge] = await database.db.insert(challenges).values({ slug: `c-${randomUUID()}`, title: "C", difficulty: 3 }).returning();
  const [version] = await database.db
    .insert(challengeVersions)
    .values({ challengeId: challenge?.id ?? "", version: 1, specJson: { skills: { linux: 0.8, nginx: 0.2 } }, imageRef: "img", checkerHash: "sha256:x", source: "human" })
    .returning();
  return version?.id ?? "";
}

async function finishedAttempt({ status, started = true, flagged = false }: Finished): Promise<AttemptFinished> {
  const userId = await aUser();
  const versionId = await aVersion();
  const startedAt = started ? new Date() : null;
  const [attempt] = await database.db.insert(attempts).values({ userId, challengeVersionId: versionId, seed: 1, context: "catalog", status, flagged, startedAt }).returning();
  return { version: 1, attempt_id: attempt?.id ?? "", user_id: userId, challenge_version_id: versionId, status, checks_used: 1, finished_at: new Date().toISOString() };
}

async function skillRatings(userId: string): Promise<Record<string, number>> {
  const rows = await database.db.select().from(userSkills).where(eq(userSkills.userId, userId));
  return Object.fromEntries(rows.map((row) => [row.skill, row.rating]));
}

async function versionRating(versionId: string): Promise<number | undefined> {
  const [version] = await database.db.select({ rating: challengeVersions.rating }).from(challengeVersions).where(eq(challengeVersions.id, versionId));
  return version?.rating;
}

// expectedSkill is a starting skill after one game against a starting version, moved by its weight.
function expectedSkill(score: number, weight: number): number {
  const full = updateRating(START, [{ opponent: START, score }]);
  return START.rating + weight * (full.rating - START.rating);
}

describe("rateAttempt", () => {
  it("raises the skills by their weights and lowers the version after a solve, once", async () => {
    const event = await finishedAttempt({ status: "solved" });

    await rateAttempt(database.db, event);
    await rateAttempt(database.db, event);
    const skills = await skillRatings(event.user_id);
    expect(skills.linux).toBeCloseTo(expectedSkill(1, 0.8), 3);
    expect(skills.nginx).toBeCloseTo(expectedSkill(1, 0.2), 3);
    expect(await versionRating(event.challenge_version_id)).toBeLessThan(START.rating);
  });

  it("lowers the skills and raises the version after a failure", async () => {
    const event = await finishedAttempt({ status: "failed" });

    await rateAttempt(database.db, event);
    expect((await skillRatings(event.user_id)).linux).toBeCloseTo(expectedSkill(0, 0.8), 3);
    expect(await versionRating(event.challenge_version_id)).toBeGreaterThan(START.rating);
  });

  it.each([
    ["a flagged attempt", { status: "solved" as const, flagged: true }],
    ["an attempt whose sandbox never started", { status: "failed" as const, started: false }],
  ])("leaves the ratings alone for %s", async (_name, finished) => {
    const event = await finishedAttempt(finished);

    await rateAttempt(database.db, event);
    expect(await skillRatings(event.user_id)).toEqual({});
    expect(await versionRating(event.challenge_version_id)).toBe(START.rating);
  });

  it("rates attempts read from the attempt.finished stream", async () => {
    const event = await finishedAttempt({ status: "solved" });
    await redis.xAdd(STREAM_ATTEMPT_FINISHED, "*", { [QUEUE_PAYLOAD_FIELD]: JSON.stringify(event) });

    await consumeFinishedBatch({ db: database.db, redis, handler: ratingHandler }, 100);
    expect((await skillRatings(event.user_id)).linux).toBeGreaterThan(START.rating);
  });
});
