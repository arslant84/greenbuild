import { randomUUID } from "node:crypto";
import { connect, consents, eq } from "@greenbuild/db";
import { describe, expect, it } from "vitest";
import { playerToken, useAttemptsApp } from "../testing/attempts-app.js";

// architecture.md, task 47a: PUT /v1/me/discovery, and GET for the settings screen (task 47b). Being found needs the 18+ confirmation; leaving and
// returning to hidden grants and revokes the discovery consent, keeping the history.
const app = useAttemptsApp();

async function discovery(userId: string, body: unknown): Promise<Response> {
  const token = await playerToken(app, userId);
  return fetch(`${app().baseUrl}/v1/me/discovery`, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function consentHistory(userId: string): Promise<boolean[]> {
  const connection = connect(app().env.DATABASE_URL);
  try {
    const rows = await connection.db.select().from(consents).where(eq(consents.userId, userId)).orderBy(consents.grantedAt);
    return rows.map((row) => row.kind === "discovery" && row.revokedAt === null);
  } finally {
    await connection.close();
  }
}

describe("GET /v1/me/discovery", () => {
  it("answers hidden with nothing shared for a new player, then the choice once made", async () => {
    const userId = randomUUID();
    const token = await playerToken(app, userId);
    const read = async () => (await fetch(`${app().baseUrl}/v1/me/discovery`, { headers: { authorization: `Bearer ${token}` } })).json();

    expect(await read()).toEqual({ mode: "hidden", revealed_fields: [], age_confirmed_18: false });
    await discovery(userId, { mode: "open", confirm_18: true, revealed_fields: ["github"] });
    expect(await read()).toEqual({ mode: "open", revealed_fields: ["github"], age_confirmed_18: true });
  });
});

describe("PUT /v1/me/discovery", () => {
  it("refuses to make a player findable without the 18+ confirmation with 422", async () => {
    const userId = randomUUID();
    const response = await discovery(userId, { mode: "open" });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "unprocessable" });
    expect(await consentHistory(userId)).toEqual([]);
  });

  it("opens with the confirmation, keeps it, and grants then revokes the consent", async () => {
    const userId = randomUUID();
    const opened = await discovery(userId, { mode: "open", confirm_18: true, revealed_fields: ["github", "email"] });
    expect(opened.status).toBe(200);
    expect(await opened.json()).toEqual({ mode: "open", revealed_fields: ["github", "email"], age_confirmed_18: true });

    expect(await (await discovery(userId, { mode: "passive" })).json()).toEqual({ mode: "passive", revealed_fields: ["github", "email"], age_confirmed_18: true });
    expect(await consentHistory(userId)).toEqual([true]);

    await discovery(userId, { mode: "hidden" });
    await discovery(userId, { mode: "open" });
    expect(await consentHistory(userId)).toEqual([false, true]);
  });

  it("lets a player stay hidden without the confirmation", async () => {
    expect(await (await discovery(randomUUID(), { mode: "hidden" })).json()).toEqual({ mode: "hidden", revealed_fields: [], age_confirmed_18: false });
  });

  it.each([
    ["an unknown mode", { mode: "public" }],
    ["a field twice", { mode: "hidden", revealed_fields: ["email", "email"] }],
    ["a confirmation that is not true", { mode: "open", confirm_18: false }],
  ])("rejects %s with 400", async (_name, body) => {
    expect((await discovery(randomUUID(), body)).status).toBe(400);
  });
});
