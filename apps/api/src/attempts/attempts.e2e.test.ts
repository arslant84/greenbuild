import { randomUUID } from "node:crypto";
import { sandboxCreateSchema, STREAM_SANDBOX_CREATE } from "@greenbuild/shared";
import { createClient } from "redis";
import { describe, expect, it } from "vitest";
import { signDevUserToken } from "../auth/dev-user-token.js";
import { type AttemptsApp, TEST_DEV_AUTH_SECRET, useAttemptsApp } from "../testing/attempts-app.js";

const NGINX_502 = { challenge_slug: "nginx-502-upstream" };

async function as(app: () => AttemptsApp, userId: string) {
  const token = await signDevUserToken(TEST_DEV_AUTH_SECRET, userId);
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  return {
    start: (body: unknown) => fetch(`${app().baseUrl}/v1/attempts`, { method: "POST", headers, body: JSON.stringify(body) }),
    find: (id: string) => fetch(`${app().baseUrl}/v1/attempts/${id}`, { headers }),
  };
}

async function queuedRequests(app: () => AttemptsApp) {
  const client = createClient({ url: app().env.REDIS_URL });
  await client.connect();
  const entries = await client.xRange(STREAM_SANDBOX_CREATE, "-", "+");
  await client.close();
  return (entries ?? []).map((entry) => sandboxCreateSchema.parse(JSON.parse(String(entry.message.payload))));
}

describe("POST and GET /v1/attempts on PostgreSQL and Redis", () => {
  const app = useAttemptsApp();

  it("starts an attempt and asks the engine for a sized, seeded sandbox", async () => {
    const player = await as(app, randomUUID());
    const response = await player.start(NGINX_502);
    const attempt = (await response.json()) as { id: string; status: string; challenge_slug: string };

    expect(response.status).toBe(201);
    expect(attempt).toMatchObject({ status: "starting", challenge_slug: "nginx-502-upstream" });
    const request = (await queuedRequests(app)).find((queued) => queued.attempt_id === attempt.id);
    expect(request).toMatchObject({ image: "greenbuild-challenge/nginx-502-upstream:dev", cpu_millis: 500, ttl_seconds: 900, network: "none" });
    expect(request?.capabilities).toEqual(["CHOWN", "SETUID", "SETGID"]);
    expect(await (await player.find(attempt.id)).json()).toEqual(attempt);
  });

  it("allows one active attempt per user", async () => {
    const player = await as(app, randomUUID());
    expect((await player.start(NGINX_502)).status).toBe(201);

    const second = await player.start(NGINX_502);
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ code: "conflict" });
  });

  it("hides other users' attempts", async () => {
    const owner = await as(app, randomUUID());
    const { id } = (await (await owner.start(NGINX_502)).json()) as { id: string };

    expect((await (await as(app, randomUUID())).find(id)).status).toBe(404);
  });

  it.each([
    ["an unknown challenge", { challenge_slug: "no-such-challenge" }, 404],
    ["a malformed slug", { challenge_slug: "../etc" }, 400],
    ["extra fields", { ...NGINX_502, seed: 1 }, 400],
  ])("answers %s with %d", async (_name, body, status) => {
    expect((await (await as(app, randomUUID())).start(body)).status).toBe(status);
  });

  it("refuses requests without a token", async () => {
    const response = await fetch(`${app().baseUrl}/v1/attempts`, { method: "POST", body: JSON.stringify(NGINX_502) });

    expect(response.status).toBe(401);
  });
});
