import { randomUUID } from "node:crypto";
import type { HintResponse } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { player, useAttemptsApp } from "../testing/attempts-app.js";
import { readyAttempt, waitForStatus } from "../testing/engine-status.js";

// architecture.md, task 35b: POST /v1/attempts/{id}/hint on PostgreSQL. nginx-502 has 3 hints.
const NGINX_502_HINTS = 3;

describe("POST /v1/attempts/{id}/hint", () => {
  const app = useAttemptsApp();

  it("gives the hints in order, then answers 409", async () => {
    const user = await player(app, randomUUID());
    const id = await readyAttempt(app, user);
    const hints: HintResponse[] = [];
    for (let taken = 0; taken < NGINX_502_HINTS; taken += 1) {
      const response = await user.hint(id);
      expect(response.status).toBe(200);
      hints.push((await response.json()) as HintResponse);
    }
    expect(hints.map((hint) => [hint.number, hint.hints_left])).toEqual([
      [1, 2],
      [2, 1],
      [3, 0],
    ]);
    expect(new Set(hints.map((hint) => hint.hint)).size).toBe(NGINX_502_HINTS);
    expect((await user.hint(id)).status).toBe(409);
  });

  it("does not skip or repeat a hint when requests arrive together", async () => {
    const user = await player(app, randomUUID());
    const id = await readyAttempt(app, user);
    const responses = await Promise.all(Array.from({ length: NGINX_502_HINTS + 1 }, () => user.hint(id)));
    const given = await Promise.all(responses.filter((response) => response.status === 200).map((response) => response.json() as Promise<HintResponse>));
    expect(given.map((hint) => hint.number).sort()).toEqual([1, 2, 3]);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
  });

  it("answers 404 for another player's attempt and 409 once the attempt is over", async () => {
    const owner = await player(app, randomUUID());
    const id = await readyAttempt(app, owner);
    expect((await (await player(app, randomUUID())).hint(id)).status).toBe(404);
    await owner.abandon(id);
    await waitForStatus(owner, id, "abandoned");
    expect((await owner.hint(id)).status).toBe(409);
  });
});
