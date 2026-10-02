import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { player, useAttemptsApp } from "../testing/attempts-app.js";
import { readyAttempt } from "../testing/engine-status.js";

describe("GET /v1/challenges/{slug} and the attempt's timing fields", () => {
  const app = useAttemptsApp();

  it("shows the live version's card", async () => {
    const response = await (await player(app, randomUUID())).card("nginx-502-upstream");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ slug: "nginx-502-upstream", version: 1, difficulty: 4, time_limit_sec: 900, skills: ["linux", "nginx"] });
  });

  it.each([
    ["an unknown challenge", "no-such-challenge", 404],
    ["a malformed slug", "NGINX..502", 400],
  ])("answers %s with %d", async (_name, slug, status) => {
    expect((await (await player(app, randomUUID())).card(slug)).status).toBe(status);
  });

  it("refuses requests without a token", async () => {
    expect((await fetch(`${app().baseUrl}/v1/challenges/nginx-502-upstream`)).status).toBe(401);
  });

  it("tells when the attempt's clock started", async () => {
    const user = await player(app, randomUUID());
    const id = await readyAttempt(app, user);
    const attempt = (await (await user.find(id)).json()) as { started_at: string | null; checks_used: number };
    expect(Date.parse(attempt.started_at ?? "")).toBeLessThanOrEqual(Date.now());
    expect(attempt.checks_used).toBe(0);
  });
});
