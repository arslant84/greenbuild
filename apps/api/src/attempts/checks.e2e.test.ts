import { randomUUID } from "node:crypto";
import { ATTEMPT_MAX_CHECKS } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { type AttemptsApp, type Player, player, TEST_ENGINE_TOKEN, useAttemptsApp } from "../testing/attempts-app.js";
import { readyAttempt, startedBy } from "../testing/engine-status.js";

const PASSED = { status: 200, body: { passed: true, output_tail: "the site is back\n", duration_ms: 120 } };

async function expectSolved(user: Player, id: string): Promise<void> {
  const result = (await (await user.result(id)).json()) as Record<string, unknown>;
  expect(result).toMatchObject({ id, status: "solved", challenge_slug: "nginx-502-upstream", checks_used: 2 });
  expect(result.duration_ms).toEqual(expect.any(Number));
  expect(result.checks).toMatchObject([{ passed: false }, { passed: true, output_tail: "the site is back\n" }]);
}

// expectEngineAsked checks what the API sent the engine: the sandbox from the ready status and the challenge.
function expectEngineAsked(app: AttemptsApp, id: string): void {
  expect(app.engine.requests.at(-1)).toEqual({
    url: `/internal/attempts/${id}/check`,
    authorization: `Bearer ${TEST_ENGINE_TOKEN}`,
    body: { sandbox_id: `sbx-${id}`, challenge_id: "nginx-502-upstream" },
  });
}

describe("POST /v1/attempts/{id}/check and GET /v1/attempts/{id}/result", () => {
  const app = useAttemptsApp();

  it("records each run and solves the attempt when a check passes", async () => {
    const user = await player(app, randomUUID());
    const id = await readyAttempt(app, user);

    expect(await (await user.check(id)).json()).toMatchObject({ passed: false, checks_left: ATTEMPT_MAX_CHECKS - 1 });
    app().engine.answers.push(PASSED);
    expect(await (await user.check(id)).json()).toEqual({ passed: true, output_tail: "the site is back\n", duration_ms: 120, checks_left: ATTEMPT_MAX_CHECKS - 2 });

    await expectSolved(user, id);
    expectEngineAsked(app(), id);
    expect((await user.check(id)).status).toBe(409);
  });

  it("gives the check back when the engine cannot run it", async () => {
    const user = await player(app, randomUUID());
    const id = await readyAttempt(app, user);
    app().engine.answers.push({ status: 500, body: {} });

    const response = await user.check(id);
    expect({ status: response.status, body: await response.json() }).toEqual({ status: 503, body: { code: "unavailable", message: "The check could not run" } });
    expect(await (await user.result(id)).json()).toMatchObject({ checks_used: 0, checks: [] });
  });

  it(`allows ${ATTEMPT_MAX_CHECKS} checks per attempt`, async () => {
    const user = await player(app, randomUUID());
    const id = await readyAttempt(app, user);
    for (let check = 0; check < ATTEMPT_MAX_CHECKS; check++) {
      expect((await user.check(id)).status).toBe(200);
    }

    const over = await user.check(id);
    expect(over.status).toBe(429);
    expect(await over.json()).toMatchObject({ code: "rate_limited" });
  });

  it("answers only the owner and only for a running sandbox", async () => {
    const owner = await player(app, randomUUID());
    const id = await readyAttempt(app, owner);
    const stranger = await player(app, randomUUID());
    const waiting = await player(app, randomUUID());

    expect((await stranger.check(id)).status).toBe(404);
    expect((await stranger.result(id)).status).toBe(404);
    expect((await waiting.check((await startedBy(waiting)).id)).status).toBe(409);
  });
});
