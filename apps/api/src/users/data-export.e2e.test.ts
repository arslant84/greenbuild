import { randomUUID } from "node:crypto";
import { and, connect, eq, privacyRequests, users } from "@greenbuild/db";
import { describe, expect, it } from "vitest";
import { useAttemptsApp } from "../testing/attempts-app.js";

// architecture.md, "Права пользователя", task 50a: POST /v1/me/export records one export request at a time.
const app = useAttemptsApp();

async function aSignedInUser(): Promise<string> {
  const connection = connect(app().env.DATABASE_URL);
  try {
    const [user] = await connection.db.insert(users).values({ email: `${randomUUID()}@example.com` }).returning({ id: users.id });
    return user?.id ?? "";
  } finally {
    await connection.close();
  }
}

async function requestExport(userId: string): Promise<Response> {
  return fetch(`${app().baseUrl}/v1/me/export`, { method: "POST", headers: { authorization: `Bearer ${await app().signApiToken(userId)}` } });
}

async function exportRequests(userId: string): Promise<{ id: string; status: string }[]> {
  const connection = connect(app().env.DATABASE_URL);
  try {
    return await connection.db
      .select({ id: privacyRequests.id, status: privacyRequests.status })
      .from(privacyRequests)
      .where(and(eq(privacyRequests.userId, userId), eq(privacyRequests.kind, "export")));
  } finally {
    await connection.close();
  }
}

describe("POST /v1/me/export", () => {
  it("records a pending export request and answers it again while it is open, also when asked twice at once", async () => {
    const userId = await aSignedInUser();

    const [first, second] = await Promise.all([requestExport(userId), requestExport(userId)]);
    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    const body = (await first.json()) as { request_id: string; requested_at: string };
    expect(await second.json()).toEqual(body);
    expect(await exportRequests(userId)).toEqual([{ id: body.request_id, status: "pending" }]);
  });

  it("records a new request once the last one is completed", async () => {
    const userId = await aSignedInUser();
    const { request_id: done } = (await (await requestExport(userId)).json()) as { request_id: string };
    const connection = connect(app().env.DATABASE_URL);
    try {
      await connection.db.update(privacyRequests).set({ status: "completed" }).where(eq(privacyRequests.id, done));
    } finally {
      await connection.close();
    }

    const { request_id: next } = (await (await requestExport(userId)).json()) as { request_id: string };
    expect(next).not.toBe(done);
  });

  it("answers 401 without a session", async () => {
    expect((await fetch(`${app().baseUrl}/v1/me/export`, { method: "POST" })).status).toBe(401);
  });
});
