import { randomUUID } from "node:crypto";
import { jwtVerify } from "jose";
import { describe, expect, it } from "vitest";
import { player, TEST_ATTACH_SECRET, useAttemptsApp } from "../testing/attempts-app.js";
import { engineReports, NGINX_502, startedBy, statusMessage, waitForStatus } from "../testing/engine-status.js";

describe("the API applies sandbox.status", () => {
  const app = useAttemptsApp();

  it("makes the attempt ready and hands out a 60-second attach token the engine accepts", async () => {
    const user = await player(app, randomUUID());
    const { id } = await startedBy(user);
    await engineReports(app, "not json");
    await engineReports(app, statusMessage({ attempt_id: id, status: "ready", sandbox_id: `sbx-${id}` }));
    await engineReports(app, statusMessage({ attempt_id: id, status: "ready", sandbox_id: `sbx-${id}` }));

    const attempt = await waitForStatus(user, id, "ready");
    const { payload } = await jwtVerify(attempt.attach_token ?? "", new TextEncoder().encode(TEST_ATTACH_SECRET), { audience: "sandbox-attach" });
    expect(payload).toMatchObject({ sandbox_id: `sbx-${id}`, attempt_id: id, sub: user.userId });
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(60);
  });

  it("marks a failed start and lets the user start again", async () => {
    const user = await player(app, randomUUID());
    const { id } = await startedBy(user);
    await engineReports(app, statusMessage({ attempt_id: id, status: "failed", reason: "sandbox could not be started (Unavailable)" }));

    expect(await waitForStatus(user, id, "failed")).not.toHaveProperty("attach_token");
    expect((await user.start(NGINX_502)).status).toBe(201);
  });

  it("expires the attempt when its sandbox is destroyed", async () => {
    const user = await player(app, randomUUID());
    const { id } = await startedBy(user);
    await engineReports(app, statusMessage({ attempt_id: id, status: "ready", sandbox_id: `sbx-${id}` }));
    await waitForStatus(user, id, "ready");
    await engineReports(app, statusMessage({ attempt_id: id, status: "destroyed", reason: "ttl" }));

    expect(await waitForStatus(user, id, "expired")).not.toHaveProperty("attach_token");
  });
});
