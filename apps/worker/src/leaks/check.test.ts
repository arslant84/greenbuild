import { randomUUID } from "node:crypto";
import { applyMigrations, attempts, challenges, challengeVersions, connect, eq, sql, users } from "@greenbuild/db";
import { type Container, startContainer } from "@greenbuild/testkit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkLeaks, isLeakSuspected, LEAK_SUSPECTED } from "./check.js";

// architecture.md, "Утечки и ротация" (task 49d).
const NOW = new Date("2026-11-30T12:00:00Z");
const DAY_MS = 86_400_000;
const BASELINE = { solveRate: 0.4, medianSolveMs: 600_000 };
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

describe("isLeakSuspected", () => {
  it.each([
    ["more and faster solves", { attempts: 20, solveRate: 0.7, medianSolveMs: 300_000 }, true],
    ["too few recent attempts", { attempts: 19, solveRate: 0.9, medianSolveMs: 60_000 }, false],
    ["a solve rate only 20 points up", { attempts: 40, solveRate: 0.6, medianSolveMs: 60_000 }, false],
    ["solves not twice as fast", { attempts: 40, solveRate: 0.9, medianSolveMs: 400_000 }, false],
  ])("%s → %s", (_name, recent, suspected) => {
    expect(isLeakSuspected(BASELINE, recent)).toBe(suspected);
  });
});

interface Played {
  count: number;
  solved: number;
  durationMs: number;
  daysAgo: number;
}

async function aVersion(): Promise<string> {
  const [challenge] = await database.db.insert(challenges).values({ slug: `c-${randomUUID()}`, title: "C", difficulty: 3 }).returning();
  const [version] = await database.db
    .insert(challengeVersions)
    .values({ challengeId: challenge?.id ?? "", version: 1, specJson: {}, imageRef: "img", checkerHash: "sha256:x", source: "human" })
    .returning();
  return version?.id ?? "";
}

// play adds count finished attempts at the version, the first solved of them solved.
async function play(versionId: string, { count, solved, durationMs, daysAgo }: Played): Promise<void> {
  const [user] = await database.db.insert(users).values({}).returning();
  const finishedAt = new Date(NOW.getTime() - daysAgo * DAY_MS);
  const rows = Array.from({ length: count }, (_, index) => ({
    userId: user?.id ?? "",
    challengeVersionId: versionId,
    seed: 1,
    context: "catalog" as const,
    status: index < solved ? ("solved" as const) : ("failed" as const),
    startedAt: finishedAt,
    finishedAt: new Date(finishedAt.getTime() + index),
    durationMs,
  }));
  await database.db.insert(attempts).values(rows);
}

async function versionRow(versionId: string): Promise<typeof challengeVersions.$inferSelect | undefined> {
  return (await database.db.select().from(challengeVersions).where(eq(challengeVersions.id, versionId)))[0];
}

describe("checkLeaks", () => {
  it("sets the baseline from the first 30 played attempts and retires a version that then looks leaked, once", async () => {
    const leaked = await aVersion();
    await play(leaked, { count: 30, solved: 12, durationMs: 600_000, daysAgo: 30 });
    await play(leaked, { count: 20, solved: 18, durationMs: 120_000, daysAgo: 2 });

    expect(await checkLeaks(database.db, NOW)).toEqual([leaked]);
    expect(await versionRow(leaked)).toMatchObject({ solveRateBaseline: 0.4, medianSolveMsBaseline: 600_000, retiredReason: LEAK_SUSPECTED });
    expect(await checkLeaks(database.db, NOW)).toEqual([]);
  });

  it("keeps a version without a baseline or with an ordinary week", async () => {
    const young = await aVersion();
    await play(young, { count: 10, solved: 9, durationMs: 60_000, daysAgo: 1 });
    const steady = await aVersion();
    await play(steady, { count: 30, solved: 12, durationMs: 600_000, daysAgo: 30 });
    await play(steady, { count: 20, solved: 9, durationMs: 580_000, daysAgo: 2 });

    expect(await checkLeaks(database.db, NOW)).toEqual([]);
    expect(await versionRow(young)).toMatchObject({ solveRateBaseline: null, retiredReason: null });
    expect(await versionRow(steady)).toMatchObject({ retiredReason: null });
  });
});
