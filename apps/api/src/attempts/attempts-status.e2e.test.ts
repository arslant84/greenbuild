import { randomUUID } from "node:crypto";
import { QUEUE_PAYLOAD_FIELD, STREAM_SANDBOX_STATUS } from "@greenbuild/shared";
import { jwtVerify } from "jose";
import { createClient } from "redis";
import { describe, expect, it } from "vitest";
import { type AttemptsApp, type Player, player, TEST_ATTACH_SECRET, useAttemptsApp } from "../testing/attempts-app.js";

const NGINX_502 = { challenge_slug: "nginx-502-upstream" };
const STATUS_WAIT_MS = 10_000;

interface Attempt {
  id: string;
  status: string;
  attach_token?: string;
}

// engineReports publishes on sandbox.status what the engine would.
async function engineReports(app: () => AttemptsApp, payload: string): Promise<void> {
  const client = createClient({ url: app().env.REDIS_URL });
  await client.connect();
  await client.xAdd(STREAM_SANDBOX_STATUS, "*", { [QUEUE_PAYLOAD_FIELD]: payload });
  await client.close();
}

async function startedBy(user: Player): Promise<Attempt> {
  return (await (await user.start(NGINX_502)).json()) as Attempt;
}

async function waitForStatus(user: Player, id: string, status: string): Promise<Attempt> {
  const deadline = Date.now() + STATUS_WAIT_MS;
  for (;;) {
    const attempt = (await (await user.find(id)).json()) as Attempt;
    if (attempt.status === status || Date.now() > deadline) {
      return attempt;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe("the API applies sandbox.status", () => {
  const app = useAttemptsApp();
  const status = (body: object) => JSON.stringify({ version: 1, ...body });

  it("makes the attempt ready and hands out a 60-second attach token the engine accepts", async () => {
    const user = await player(app, randomUUID());
    const { id } = await startedBy(user);
    await engineReports(app, "not json");
    await engineReports(app, status({ attempt_id: id, status: "ready", sandbox_id: `sbx-${id}` }));
    await engineReports(app, status({ attempt_id: id, status: "ready", sandbox_id: `sbx-${id}` }));

    const attempt = await waitForStatus(user, id, "ready");
    const { payload } = await jwtVerify(attempt.attach_token ?? "", new TextEncoder().encode(TEST_ATTACH_SECRET), { audience: "sandbox-attach" });
    expect(payload).toMatchObject({ sandbox_id: `sbx-${id}`, attempt_id: id, sub: user.userId });
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(60);
  });

  it("marks a failed start and lets the user start again", async () => {
    const user = await player(app, randomUUID());
    const { id } = await startedBy(user);
    await engineReports(app, status({ attempt_id: id, status: "failed", reason: "sandbox could not be started (Unavailable)" }));

    expect(await waitForStatus(user, id, "failed")).not.toHaveProperty("attach_token");
    expect((await user.start(NGINX_502)).status).toBe(201);
  });

  it("expires the attempt when its sandbox is destroyed", async () => {
    const user = await player(app, randomUUID());
    const { id } = await startedBy(user);
    await engineReports(app, status({ attempt_id: id, status: "ready", sandbox_id: `sbx-${id}` }));
    await waitForStatus(user, id, "ready");
    await engineReports(app, status({ attempt_id: id, status: "destroyed", reason: "ttl" }));

    expect(await waitForStatus(user, id, "expired")).not.toHaveProperty("attach_token");
  });
});
