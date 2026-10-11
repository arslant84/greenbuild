import { randomUUID } from "node:crypto";
import { connect, users, userSettings } from "@greenbuild/db";
import { isoWeek, leaderboardKeys, utcDay } from "@greenbuild/shared";
import { createClient } from "redis";
import { describe, expect, it } from "vitest";
import { signDevUserToken } from "../auth/dev-user-token.js";
import { TEST_DEV_AUTH_SECRET, useAttemptsApp } from "../testing/attempts-app.js";

// architecture.md, task 45b: GET /v1/leaderboards/{kind} reads the boards the worker keeps (45a). The
// worker is not running here, so the tests fill Redis and the users table themselves.
const app = useAttemptsApp();

async function board(userId: string, path: string): Promise<Response> {
  const token = await signDevUserToken(TEST_DEV_AUTH_SECRET, userId);
  return fetch(`${app().baseUrl}/v1/leaderboards/${path}`, { headers: { authorization: `Bearer ${token}` } });
}

async function players(rows: { id: string; handle: string | null; isPublic?: boolean }[]): Promise<void> {
  const connection = connect(app().env.DATABASE_URL);
  try {
    await connection.db.insert(users).values(rows.map(({ id, handle }) => ({ id, handle })));
    const hidden = rows.filter((row) => row.isPublic === false);
    if (hidden.length > 0) {
      await connection.db.insert(userSettings).values(hidden.map((row) => ({ userId: row.id, gameProfilePublic: false })));
    }
  } finally {
    await connection.close();
  }
}

async function scores(key: string, members: { value: string; score: number }[]): Promise<void> {
  const redis = createClient({ url: app().env.REDIS_URL });
  await redis.connect();
  try {
    await redis.zAdd(key, members);
  } finally {
    await redis.close();
  }
}

describe("GET /v1/leaderboards/{kind}", () => {
  it("ranks this week's XP, hides names of private profiles and places the player", async () => {
    const [ada, hidden, me] = [randomUUID(), randomUUID(), randomUUID()];
    await players([
      { id: ada, handle: `ada-${ada.slice(0, 6)}` },
      { id: hidden, handle: `hid-${hidden.slice(0, 6)}`, isPublic: false },
      { id: me, handle: null },
    ]);
    await scores(leaderboardKeys.globalWeekly(isoWeek(new Date())), [
      { value: me, score: 50 },
      { value: ada, score: 300 },
      { value: hidden, score: 120 },
    ]);

    const response = await board(me, "weekly");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      kind: "weekly",
      entries: [
        { rank: 1, handle: `ada-${ada.slice(0, 6)}`, display_name: null, score: 300 },
        { rank: 2, handle: null, display_name: null, score: 120 },
        { rank: 3, handle: null, display_name: null, score: 50 },
      ],
      me: { rank: 3, score: 50 },
    });
  });

  it("ranks today's daily challenge by the lowest time, and has no place for an absent player", async () => {
    const [fast, slow] = [randomUUID(), randomUUID()];
    await players([
      { id: fast, handle: null },
      { id: slow, handle: null },
    ]);
    await scores(leaderboardKeys.daily(utcDay(new Date()), "linux"), [
      { value: slow, score: 240_000 },
      { value: fast, score: 90_000 },
    ]);

    const body = (await (await board(randomUUID(), "daily")).json()) as { entries: { score: number }[]; me: unknown };
    expect(body.entries.map((entry) => entry.score)).toEqual([90_000, 240_000]);
    expect(body.me).toBeNull();
  });
});

describe("GET /v1/leaderboards/{kind} input", () => {
  it.each([
    ["the skill board without a skill", "skill"],
    ["an unknown board", "monthly"],
    ["a lowercase country", "weekly?country=kz"],
  ])("rejects %s with 400", async (_name, path) => {
    expect((await board(randomUUID(), path)).status).toBe(400);
  });
});
