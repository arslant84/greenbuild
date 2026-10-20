import { randomUUID } from "node:crypto";
import { connect, eq, users } from "@greenbuild/db";
import { DEFAULT_REMINDER_HOUR } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { playerToken, useAttemptsApp } from "../testing/attempts-app.js";

// architecture.md, task 52: GET and PUT /v1/me/notifications, the opt-in streak reminder and its hour.
const app = useAttemptsApp();

async function call(userId: string, method: "GET" | "PUT", body?: unknown): Promise<Response> {
  const token = await playerToken(app, userId);
  return fetch(`${app().baseUrl}/v1/me/notifications`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function aPlayerWithEmail(): Promise<string> {
  const userId = randomUUID();
  await playerToken(app, userId);
  const connection = connect(app().env.DATABASE_URL);
  try {
    await connection.db.update(users).set({ email: `${userId}@example.com` }).where(eq(users.id, userId));
  } finally {
    await connection.close();
  }
  return userId;
}

describe("/v1/me/notifications", () => {
  it("answers no reminder at the default hour for a new player, then the choice once made", async () => {
    const userId = await aPlayerWithEmail();

    expect(await (await call(userId, "GET")).json()).toEqual({ streak_reminder_email: false, reminder_hour: DEFAULT_REMINDER_HOUR });
    expect((await call(userId, "PUT", { streak_reminder_email: true, reminder_hour: 7 })).status).toBe(200);
    expect(await (await call(userId, "GET")).json()).toEqual({ streak_reminder_email: true, reminder_hour: 7 });
  });

  it("refuses to turn reminders on for a player without an email address", async () => {
    const response = await call(randomUUID(), "PUT", { streak_reminder_email: true, reminder_hour: 19 });

    expect(response.status).toBe(422);
  });

  it.each([{ streak_reminder_email: true, reminder_hour: 24 }, { streak_reminder_email: "yes", reminder_hour: 19 }, { streak_reminder_email: true }])(
    "rejects %o with 400",
    async (body) => {
      expect((await call(await aPlayerWithEmail(), "PUT", body)).status).toBe(400);
    },
  );
});
