import { randomUUID } from "node:crypto";
import { BlobServiceClient } from "@azure/storage-blob";
import { and, connect, eq, privacyRequests, users } from "@greenbuild/db";
import { EXPORT_LINK_DAYS, EXPORTS_BLOB_CONTAINER } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { useAttemptsApp } from "../testing/attempts-app.js";

// architecture.md, "Права пользователя", task 50a: POST /v1/me/export records one export request at a time.
const app = useAttemptsApp({ exportArchives: true });
const DAY_MS = 86_400_000;

async function aSignedInUser(): Promise<string> {
  const connection = connect(app().env.DATABASE_URL);
  try {
    const [user] = await connection.db.insert(users).values({ email: `${randomUUID()}@example.com`, ageConfirmed16At: new Date() }).returning({ id: users.id });
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

// aCompletedExport is an export the worker finished daysAgo, its archive stored as the worker does.
async function aCompletedExport(userId: string, daysAgo: number): Promise<string> {
  const id = randomUUID();
  const archive = JSON.stringify({ format: 1, account: { id: userId } });
  const container = BlobServiceClient.fromConnectionString(app().env.EXPORT_BLOB_CONNECTION_STRING ?? "").getContainerClient(EXPORTS_BLOB_CONTAINER);
  await container.createIfNotExists();
  await container.getBlockBlobClient(`${id}.json`).upload(archive, archive.length);
  const connection = connect(app().env.DATABASE_URL);
  try {
    const completedAt = new Date(Date.now() - daysAgo * DAY_MS);
    await connection.db.insert(privacyRequests).values({ id, userId, kind: "export", status: "completed", completedAt, artifactRef: `${id}.json` });
  } finally {
    await connection.close();
  }
  return id;
}

async function download(userId: string, id: string): Promise<Response> {
  return fetch(`${app().baseUrl}/v1/me/export/${id}`, { headers: { authorization: `Bearer ${await app().signApiToken(userId)}` } });
}

describe("GET /v1/me/export/{id}", () => {
  it("answers the owner's archive as a JSON file", async () => {
    const userId = await aSignedInUser();
    const id = await aCompletedExport(userId, 1);

    const response = await download(userId, id);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="greenbuild-export-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(await response.json()).toEqual({ format: 1, account: { id: userId } });
  });

  it("answers 404 to another player, after the link expired, and for an export not finished yet", async () => {
    const owner = await aSignedInUser();
    const id = await aCompletedExport(owner, 1);
    const expired = await aCompletedExport(owner, EXPORT_LINK_DAYS + 1);
    const { request_id: pending } = (await (await requestExport(owner)).json()) as { request_id: string };

    expect((await download(await aSignedInUser(), id)).status).toBe(404);
    expect((await download(owner, expired)).status).toBe(404);
    expect((await download(owner, pending)).status).toBe(404);
    expect((await download(owner, "not-an-id")).status).toBe(400);
  });
});
