import { randomUUID } from "node:crypto";
import { connect, consents, eq, privacyRequests } from "@greenbuild/db";
import { describe, expect, it } from "vitest";
import { playerToken, useAttemptsApp } from "../testing/attempts-app.js";

// architecture.md, task 50b: DELETE /v1/me hides the account at once and schedules the deletion.
const app = useAttemptsApp();
const DELETION_DAYS_MS = 30 * 86_400_000;

async function me(userId: string, method: string, body?: unknown): Promise<Response> {
  const token = await playerToken(app, userId);
  const path = method === "PUT" ? "/v1/me/discovery" : "/v1/me";
  return fetch(`${app().baseUrl}${path}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? null : JSON.stringify(body) });
}

describe("DELETE /v1/me", () => {
  it("hides the profile, revokes consents and schedules the deletion 30 days out and closes the account", async () => {
    const userId = randomUUID();
    const handle = `del-${userId.slice(0, 8)}`;
    await me(userId, "PATCH", { handle });
    await me(userId, "PUT", { mode: "open", confirm_18: true });
    expect((await fetch(`${app().baseUrl}/v1/users/${handle}`)).status).toBe(200);

    const first = await me(userId, "DELETE");
    expect(first.status).toBe(202);
    const { deletion_scheduled_for: scheduled } = (await first.json()) as { deletion_scheduled_for: string };
    expect(Math.abs(Date.parse(scheduled) - Date.now() - DELETION_DAYS_MS)).toBeLessThan(60_000);
    expect((await me(userId, "DELETE")).status).toBe(403);

    expect((await fetch(`${app().baseUrl}/v1/users/${handle}`)).status).toBe(404);
    const connection = connect(app().env.DATABASE_URL);
    try {
      expect((await connection.db.select().from(consents).where(eq(consents.userId, userId))).every((row) => row.revokedAt !== null)).toBe(true);
      expect(await connection.db.select({ kind: privacyRequests.kind, status: privacyRequests.status }).from(privacyRequests).where(eq(privacyRequests.userId, userId))).toEqual([{ kind: "delete", status: "pending" }]);
    } finally {
      await connection.close();
    }
  });
});
