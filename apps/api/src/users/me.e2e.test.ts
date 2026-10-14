import { randomUUID } from "node:crypto";
import { connect, eq, users } from "@greenbuild/db";
import { describe, expect, it } from "vitest";
import { signDevUserToken } from "../auth/dev-user-token.js";
import { TEST_DEV_AUTH_SECRET, useAttemptsApp } from "../testing/attempts-app.js";

// architecture.md, task 32: GET and PATCH /v1/me, with the timezone changing at most once in 30 days.
const app = useAttemptsApp();
const DAY_MS = 86_400_000;

interface Me {
  get: () => Promise<Response>;
  patch: (body: unknown) => Promise<Response>;
}

async function me(userId = randomUUID()): Promise<Me> {
  const token = await signDevUserToken(TEST_DEV_AUTH_SECRET, userId);
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  return {
    get: () => fetch(`${app().baseUrl}/v1/me`, { headers }),
    patch: (body) => fetch(`${app().baseUrl}/v1/me`, { method: "PATCH", headers, body: JSON.stringify(body) }),
  };
}

async function backdateTimezoneChange(userId: string, days: number): Promise<void> {
  const connection = connect(app().env.DATABASE_URL);
  try {
    await connection.db.update(users).set({ timezoneChangedAt: new Date(Date.now() - days * DAY_MS) }).where(eq(users.id, userId));
  } finally {
    await connection.close();
  }
}

describe("GET and PATCH /v1/me", () => {
  it("reads a new player's profile with its defaults", async () => {
    const userId = randomUUID();
    const response = await (await me(userId)).get();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: userId, handle: null, display_name: null, email: null, country: null, timezone: "UTC", timezone_locked_until: null, locale: "en", xp: 0, level: 0, xp_today: 0, streak: { current: 0, longest: 0, freezes: 0 } });
  });

  it("changes the handle, name and locale, storing the handle lowercase", async () => {
    const player = await me();
    const handle = `p-${randomUUID().slice(0, 8)}`;
    const response = await player.patch({ handle: handle.toUpperCase(), display_name: "Ada", locale: "en-GB" });

    expect(response.status).toBe(200);
    expect(await (await player.get()).json()).toMatchObject({ handle, display_name: "Ada", locale: "en-GB" });
  });

  it("answers an empty change with the unchanged profile", async () => {
    const userId = randomUUID();
    const response = await (await me(userId)).patch({});

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: userId, handle: null, timezone: "UTC" });
  });

  it("refuses a handle another player has with 409", async () => {
    const handle = `t-${randomUUID().slice(0, 8)}`;
    await (await me()).patch({ handle });

    const response = await (await me()).patch({ handle });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "conflict" });
  });

  it.each([
    ["an unknown field", { email: "a@b.c" }],
    ["a handle with spaces", { handle: "no spaces" }],
    ["a timezone that does not exist", { timezone: "Mars/Base" }],
  ])("rejects %s with 400", async (_name, body) => {
    expect((await (await me()).patch(body)).status).toBe(400);
  });
});

describe("the 30-day timezone rule", () => {
  it("allows the first change and refuses a second one within 30 days with 409", async () => {
    const player = await me();
    const first = await player.patch({ timezone: "Asia/Almaty" });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ timezone: "Asia/Almaty", timezone_locked_until: expect.any(String) });

    const second = await player.patch({ timezone: "Europe/Berlin" });
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ code: "conflict", details: { timezone_locked_until: expect.any(String) } });
    expect((await player.patch({ timezone: "Asia/Almaty", display_name: "Same zone" })).status).toBe(200);
  });

  it("allows a change again after 30 days", async () => {
    const userId = randomUUID();
    const player = await me(userId);
    await player.patch({ timezone: "Asia/Almaty" });
    await backdateTimezoneChange(userId, 31);

    const response = await player.patch({ timezone: "Europe/Berlin" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ timezone: "Europe/Berlin" });
  });
});

describe("GET /v1/me for the settings screen (task 47b)", () => {
  it("includes the player's email for the settings screen", async () => {
    const userId = randomUUID();
    const player = await me(userId);
    await player.get();
    const connection = connect(app().env.DATABASE_URL);
    try {
      await connection.db.update(users).set({ email: "player@example.com" }).where(eq(users.id, userId));
    } finally {
      await connection.close();
    }

    expect(await (await player.get()).json()).toMatchObject({ email: "player@example.com" });
  });
});
