import { randomUUID } from "node:crypto";
import { applyMigrations, attempts, challenges, challengeVersions, cheatReviews, connect, eq, sql, users, xpLedger } from "@greenbuild/db";
import { type AttemptFinished, isoWeek, leaderboardKeys, QUEUE_PAYLOAD_FIELD, STREAM_ATTEMPT_FINISHED } from "@greenbuild/shared";
import { type Container, startContainer } from "@greenbuild/testkit";
import { createClient } from "redis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consumeFinishedBatch } from "../finished-consumer.js";
import { creditSolve, xpHandler } from "./credit.js";

// architecture.md, task 42a: one attempt.finished, one award, computed with the shared formula.
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

async function aVersion(skills: Record<string, number>, difficulty = 4): Promise<string> {
  const [challenge] = await database.db.insert(challenges).values({ slug: `c-${randomUUID()}`, title: "C", difficulty }).returning();
  const [version] = await database.db
    .insert(challengeVersions)
    .values({ challengeId: challenge?.id ?? "", version: 1, specJson: { skills }, imageRef: "img", checkerHash: "sha256:x", source: "human" })
    .returning();
  return version?.id ?? "";
}

interface Solve {
  userId: string;
  versionId: string;
  status?: "solved" | "failed";
  durationMs?: number;
  hintsUsed?: number;
  context?: "daily" | "catalog";
}

async function finished({ userId, versionId, status = "solved", durationMs = 60_000, hintsUsed = 0, context = "catalog" }: Solve): Promise<AttemptFinished> {
  const [attempt] = await database.db
    .insert(attempts)
    .values({ userId, challengeVersionId: versionId, seed: 1, context, status, durationMs, hintsUsed })
    .returning();
  return { version: 1, attempt_id: attempt?.id ?? "", user_id: userId, challenge_version_id: versionId, status, duration_ms: durationMs, checks_used: 1, finished_at: new Date().toISOString() };
}

async function aUser(): Promise<string> {
  const [user] = await database.db.insert(users).values({}).returning();
  return user?.id ?? "";
}

async function ledger(attemptId: string): Promise<Record<string, number>> {
  const rows = await database.db.select().from(xpLedger).where(eq(xpLedger.attemptId, attemptId));
  return Object.fromEntries(rows.map((row) => [row.reason, row.amount]));
}

describe("creditSolve", () => {
  it("awards the solve and the new skills once, even when the event comes twice", async () => {
    const event = await finished({ userId: await aUser(), versionId: await aVersion({ nginx: 0.6, linux: 0.4 }), hintsUsed: 1, context: "daily" });

    await creditSolve(database.db, event);
    await creditSolve(database.db, event);
    // 40 base × 0.8 (one hint) × 1.5 (daily), no median yet; two new skills × 25.
    expect(await ledger(event.attempt_id)).toEqual({ solve: 48, new_skills: 50 });
  });

  it("counts only skills the player has not solved before", async () => {
    const userId = await aUser();
    await creditSolve(database.db, await finished({ userId, versionId: await aVersion({ linux: 1 }) }));
    const second = await finished({ userId, versionId: await aVersion({ linux: 0.5, tls: 0.5 }) });

    await creditSolve(database.db, second);
    expect(await ledger(second.attempt_id)).toEqual({ solve: 40, new_skills: 25 });
  });

  it("adds the speed bonus once the challenge has five other solves", async () => {
    const versionId = await aVersion({});
    for (let i = 0; i < 5; i++) {
      await finished({ userId: await aUser(), versionId, durationMs: 120_000 });
    }
    const fast = await finished({ userId: await aUser(), versionId, durationMs: 60_000 });

    await creditSolve(database.db, fast);
    expect(await ledger(fast.attempt_id)).toEqual({ solve: 60 });
  });

  it("awards nothing for an attempt that was not solved", async () => {
    const event = await finished({ userId: await aUser(), versionId: await aVersion({ linux: 1 }), status: "failed" });

    await creditSolve(database.db, event);
    expect(await ledger(event.attempt_id)).toEqual({});
  });
});

describe("xpHandler after a review", () => {
  it("takes back a voided attempt's XP and lowers the weekly board, once", async () => {
    const userId = await aUser();
    const kept = await finished({ userId, versionId: await aVersion({}) });
    const voided = await finished({ userId, versionId: await aVersion({}) });
    const deps = { db: database.db, boards: redis, logs: null };
    await xpHandler.handle(deps, kept);
    await xpHandler.handle(deps, voided);
    const week = leaderboardKeys.globalWeekly(isoWeek(new Date()));
    expect(await redis.zScore(week, userId)).toBe(80);

    await database.db.insert(cheatReviews).values({ attemptId: voided.attempt_id, reviewerId: await aUser(), decision: "void" });
    await xpHandler.handle(deps, voided);
    await xpHandler.handle(deps, voided);
    expect(await ledger(voided.attempt_id)).toEqual({});
    expect(await ledger(kept.attempt_id)).toEqual({ solve: 40 });
    expect(await redis.zScore(week, userId)).toBe(40);
  });
});

describe("consumeXpBatch", () => {
  it("credits an attempt.finished from the stream and drops a malformed one, acknowledging both", async () => {
    const event = await finished({ userId: await aUser(), versionId: await aVersion({}) });
    await redis.xAdd(STREAM_ATTEMPT_FINISHED, "*", { [QUEUE_PAYLOAD_FIELD]: JSON.stringify(event) });
    await redis.xAdd(STREAM_ATTEMPT_FINISHED, "*", { [QUEUE_PAYLOAD_FIELD]: "not json" });

    await consumeFinishedBatch({ db: database.db, redis, handler: xpHandler, logs: null }, 100);
    expect(await ledger(event.attempt_id)).toEqual({ solve: 40 });
    expect((await redis.xPending(STREAM_ATTEMPT_FINISHED, xpHandler.group)).pending).toBe(0);
  });
});
