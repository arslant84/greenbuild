import { randomUUID } from "node:crypto";
import { connect, eq, users } from "@greenbuild/db";
import { describe, expect, it } from "vitest";
import { player, useAttemptsApp } from "../testing/attempts-app.js";
import { NGINX_502 } from "../testing/engine-status.js";

// architecture.md, task 29b: attempts reference users, so the dev path creates the user a dev
// token names; Auth.js takes this over at sign-in (30a) and the dev path goes in 30e.
const app = useAttemptsApp();

async function userRows(userId: string): Promise<unknown[]> {
  const connection = connect(app().env.DATABASE_URL);
  try {
    return await connection.db.select({ id: users.id }).from(users).where(eq(users.id, userId));
  } finally {
    await connection.close();
  }
}

describe("a dev user's first request", () => {
  it("creates their users row once and lets them start an attempt", async () => {
    const userId = randomUUID();
    const user = await player(app, userId);

    expect((await user.catalog("")).status).toBe(200);
    expect((await user.catalog("")).status).toBe(200);
    expect(await userRows(userId)).toEqual([{ id: userId }]);
    expect((await user.start(NGINX_502)).status).toBe(201);
  });
});
