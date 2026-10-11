import { randomUUID } from "node:crypto";
import { connect, xpLedger } from "@greenbuild/db";
import { describe, expect, it } from "vitest";
import { signDevUserToken } from "../auth/dev-user-token.js";
import { player, TEST_DEV_AUTH_SECRET, useAttemptsApp } from "../testing/attempts-app.js";
import { readyAttempt } from "../testing/engine-status.js";

// architecture.md, task 42b: XP and level in GET /v1/me and the XP an attempt earned in its result.
// The worker is not running here, so the test writes the ledger as the worker would.
const app = useAttemptsApp();
const DAY_MS = 86_400_000;

async function me(userId: string): Promise<Record<string, unknown>> {
  const token = await signDevUserToken(TEST_DEV_AUTH_SECRET, userId);
  return (await (await fetch(`${app().baseUrl}/v1/me`, { headers: { authorization: `Bearer ${token}` } })).json()) as Record<string, unknown>;
}

async function credit(userId: string, attemptId: string): Promise<void> {
  const connection = connect(app().env.DATABASE_URL);
  try {
    await connection.db.insert(xpLedger).values([
      { userId, attemptId, reason: "solve", amount: 150 },
      { userId, attemptId, reason: "new_skills", amount: 50, createdAt: new Date(Date.now() - 3 * DAY_MS) },
    ]);
  } finally {
    await connection.close();
  }
}

describe("XP in the profile and the result", () => {
  it("shows no XP before the worker credits the attempt", async () => {
    const userId = randomUUID();
    const user = await player(app, userId);
    const id = await readyAttempt(app, user);

    expect(await (await user.result(id)).json()).toMatchObject({ xp_earned: null });
    expect(await me(userId)).toMatchObject({ xp: 0, level: 0, xp_today: 0 });
  });

  it("sums the attempt's awards, the player's total and level, and today's XP", async () => {
    const userId = randomUUID();
    const user = await player(app, userId);
    const id = await readyAttempt(app, user);
    await credit(userId, id);

    expect(await (await user.result(id)).json()).toMatchObject({ xp_earned: 200 });
    expect(await me(userId)).toMatchObject({ xp: 200, level: 1, xp_today: 150 });
  });
});
