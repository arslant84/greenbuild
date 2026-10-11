import { randomUUID } from "node:crypto";
import { applyMigrations, connect, eq, sql, streaks, users } from "@greenbuild/db";
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

  it("ignores attempts that were not solved", async () => {
    const userId = await aUser();

    await countStreak(database.db, solvedAt(userId, "2026-11-01T10:00:00Z", "failed"));
    expect(await streakOf(userId)).toBeUndefined();
  });
});
