import { randomUUID } from "node:crypto";
import { applyMigrations, attempts, attemptSignals, challenges, challengeVersions, connect, eq, sql, users } from "@greenbuild/db";
import { type Container, startContainer } from "@greenbuild/testkit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rateAttempt } from "../rating/rate.js";
import { assessAttempt } from "./assess.js";
import type { SessionLogs } from "./logs.js";
import type { LogEvent } from "./rules.js";

// architecture.md, task 49b: the worker records an attempt's signals and flags it before the rating.
const START = new Date("2026-11-01T10:00:00Z");
const MINUTE_MS = 60_000;
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

function logOf(events: LogEvent[] | null): SessionLogs {
  return { read: () => Promise.resolve(events) };
}

function at(minutes: number, type: string, data: string): LogEvent {
  return { t: new Date(START.getTime() + minutes * MINUTE_MS).toISOString(), type, data };
}

async function aVersion(): Promise<string> {
  const [challenge] = await database.db.insert(challenges).values({ slug: `c-${randomUUID()}`, title: "C", difficulty: 3 }).returning();
  const [version] = await database.db
    .insert(challengeVersions)
    .values({ challengeId: challenge?.id ?? "", version: 1, specJson: { skills: { linux: 1 } }, imageRef: "img", checkerHash: "sha256:x", source: "human" })
    .returning();
  return version?.id ?? "";
}

// solvedAttempt is a ten-minute solve with two checks; started false means the sandbox never came up.
async function solvedAttempt(started = true): Promise<string> {
  const [user] = await database.db.insert(users).values({}).returning();
  const finishedAt = new Date(START.getTime() + 10 * MINUTE_MS);
  const values = { userId: user?.id ?? "", challengeVersionId: await aVersion(), seed: 1, context: "catalog" as const, status: "solved" as const, checksUsed: 2 };
  const [attempt] = await database.db.insert(attempts).values({ ...values, startedAt: started ? START : null, finishedAt, durationMs: 10 * MINUTE_MS }).returning();
  return attempt?.id ?? "";
}

async function stateOf(attemptId: string): Promise<{ flagged: boolean | undefined; signals: string[]; rated: boolean }> {
  const [attempt] = await database.db.select().from(attempts).where(eq(attempts.id, attemptId));
  const rows = await database.db.select().from(attemptSignals).where(eq(attemptSignals.attemptId, attemptId));
  return { flagged: attempt?.flagged, signals: rows.map((row) => row.signal).sort(), rated: attempt?.ratedAt !== null };
}

describe("assessAttempt", () => {
  it("flags a pasted solve without exploration and keeps it out of the rating", async () => {
    const attemptId = await solvedAttempt();
    const pasted = [at(1, "input", "x".repeat(300)), at(2, "command", "sed -i s/a/b/ f"), at(5, "input", "y"), at(9, "input", "z")];

    await assessAttempt(database.db, logOf(pasted), attemptId);
    await assessAttempt(database.db, logOf(pasted), attemptId);
    expect(await stateOf(attemptId)).toEqual({ flagged: true, signals: ["no_exploration", "paste_large"], rated: false });
    await rateAttempt(database.db, { version: 1, attempt_id: attemptId, user_id: randomUUID(), challenge_version_id: randomUUID(), status: "solved", checks_used: 2, finished_at: new Date().toISOString() });
    expect((await stateOf(attemptId)).rated).toBe(false);
  });

  it("records nothing for a player who explored", async () => {
    const attemptId = await solvedAttempt();
    const explored = [at(1, "command", "cat /etc/nginx/nginx.conf"), at(1, "input", "a"), at(5, "input", "b"), at(9, "input", "c")];

    await assessAttempt(database.db, logOf(explored), attemptId);
    expect(await stateOf(attemptId)).toEqual({ flagged: false, signals: [], rated: false });
  });

  it("skips an attempt whose sandbox never started", async () => {
    const attemptId = await solvedAttempt(false);

    await assessAttempt(database.db, logOf([at(1, "input", "x".repeat(300))]), attemptId);
    expect((await stateOf(attemptId)).signals).toEqual([]);
  });
});
