import { randomUUID } from "node:crypto";
import { connect, eq, users } from "@greenbuild/db";
import { AGE_NOT_CONFIRMED } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { useAttemptsApp } from "../testing/attempts-app.js";

// architecture.md, task 30c: the API admits a signed-in user by the token the web app issues.
const app = useAttemptsApp();

// aSignedInUser is a user Auth.js created at sign-in (task 30a), confirmed 16+ (task 30b) unless said.
async function aSignedInUser(status: "active" | "banned" = "active", ageConfirmed = true): Promise<string> {
  const connection = connect(app().env.DATABASE_URL);
  try {
    const [user] = await connection.db
      .insert(users)
      .values({ email: `${randomUUID()}@example.com`, status, ageConfirmed16At: ageConfirmed ? new Date() : null })
      .returning({ id: users.id });
    return user?.id ?? "";
  } finally {
    await connection.close();
  }
}

async function me(token?: string): Promise<Response> {
  return fetch(`${app().baseUrl}/v1/me`, token ? { headers: { authorization: `Bearer ${token}` } } : {});
}

describe("a signed-in user's API token", () => {
  it("admits the user it names", async () => {
    const userId = await aSignedInUser();

    expect((await me(await app().signApiToken(userId))).status).toBe(200);
  });

  it("answers 401 without a token and for a user that does not exist", async () => {
    expect((await me()).status).toBe(401);
    expect((await me(await app().signApiToken(randomUUID()))).status).toBe(401);
  });

  it("refuses a banned account with 403", async () => {
    expect((await me(await app().signApiToken(await aSignedInUser("banned")))).status).toBe(403);
  });

  it("refuses an account without the 16+ confirmation with 403 and says why", async () => {
    const response = await me(await app().signApiToken(await aSignedInUser("active", false)));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "forbidden", details: { reason: AGE_NOT_CONFIRMED } });
  });

  it("does not create a user row for an unknown user, as the dev path does", async () => {
    const unknown = randomUUID();
    await me(await app().signApiToken(unknown));

    const connection = connect(app().env.DATABASE_URL);
    try {
      expect(await connection.db.select().from(users).where(eq(users.id, unknown))).toEqual([]);
    } finally {
      await connection.close();
    }
  });
});
