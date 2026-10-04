import { randomUUID } from "node:crypto";
import { sandboxDestroySchema, STREAM_SANDBOX_DESTROY } from "@greenbuild/shared";
import { createClient } from "redis";
import { describe, expect, it } from "vitest";
import { type AttemptsApp, player, useAttemptsApp } from "../testing/attempts-app.js";
import { engineReports, NGINX_502, readyAttempt, startedBy, statusMessage, waitForStatus } from "../testing/engine-status.js";

async function destroyRequests(app: () => AttemptsApp, attemptId: string) {
  const client = createClient({ url: app().env.REDIS_URL });
  await client.connect();
  const entries = await client.xRange(STREAM_SANDBOX_DESTROY, "-", "+");
  await client.close();
  return (entries ?? [])
    .map((entry) => sandboxDestroySchema.parse(JSON.parse(String(entry.message.payload))))
    .filter((request) => request.attempt_id === attemptId);
}

// POST /v1/attempts/{id}/abandon on PostgreSQL and Redis; one app for both groups.
const app = useAttemptsApp();

describe("abandoning an open attempt", () => {
  it("ends a ready attempt, asks the engine to destroy its sandbox and lets the user start again", async () => {
    const user = await player(app, randomUUID());
    const id = await readyAttempt(app, user);

    const response = await user.abandon(id);
    expect(response.status).toBe(200);
    const attempt = await response.json();
    expect(attempt).toMatchObject({ id, status: "abandoned" });
    expect(attempt).not.toHaveProperty("attach_token");
    expect(await destroyRequests(app, id)).toEqual([{ version: 1, attempt_id: id, reason: "abandoned" }]);
    expect((await user.start(NGINX_502)).status).toBe(201);
  });

  it("ends an attempt whose sandbox is still starting", async () => {
    const user = await player(app, randomUUID());
    const { id } = await startedBy(user);

    expect(await (await user.abandon(id)).json()).toMatchObject({ status: "abandoned" });
    expect(await destroyRequests(app, id)).toHaveLength(1);
  });

  it("answers a repeated call with the same status and repeats the destroy request", async () => {
    const user = await player(app, randomUUID());
    const id = await readyAttempt(app, user);
    await user.abandon(id);

    const again = await user.abandon(id);
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ status: "abandoned" });
    expect(await destroyRequests(app, id)).toHaveLength(2);
  });

  it("stays abandoned when the engine later reports the sandbox destroyed", async () => {
    const user = await player(app, randomUUID());
    const id = await readyAttempt(app, user);
    await user.abandon(id);
    await engineReports(app, statusMessage({ attempt_id: id, status: "destroyed", sandbox_id: `sbx-${id}`, reason: "abandoned" }));

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await (await user.find(id)).json()).toMatchObject({ status: "abandoned" });
  });
});

describe("abandon refuses", () => {
  it("an attempt that is already over", async () => {
    const user = await player(app, randomUUID());
    const id = await readyAttempt(app, user);
    await engineReports(app, statusMessage({ attempt_id: id, status: "destroyed", sandbox_id: `sbx-${id}`, reason: "expired" }));
    await waitForStatus(user, id, "expired");

    const response = await user.abandon(id);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "conflict" });
  });

  it("another user's attempt with 404 and leaves it running", async () => {
    const owner = await player(app, randomUUID());
    const id = await readyAttempt(app, owner);
    const stranger = await player(app, randomUUID());

    expect((await stranger.abandon(id)).status).toBe(404);
    expect(await (await owner.find(id)).json()).toMatchObject({ status: "ready" });
    expect(await destroyRequests(app, id)).toEqual([]);
  });
});
