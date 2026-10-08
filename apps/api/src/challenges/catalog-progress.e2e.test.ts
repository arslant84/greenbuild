import { randomUUID } from "node:crypto";
import type { CatalogEntry, ChallengeList } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { type Player, player, useAttemptsApp } from "../testing/attempts-app.js";
import { readyAttempt, waitForStatus } from "../testing/engine-status.js";

const PASSED = { status: 200, body: { passed: true, output_tail: "the site is back\n", duration_ms: 120 } };

async function nginx502(user: Player, query = ""): Promise<{ list: ChallengeList; entry: CatalogEntry | undefined }> {
  const list = (await (await user.catalog(`?limit=50${query}`)).json()) as ChallengeList;
  return { list, entry: list.challenges.find((card) => card.slug === "nginx-502-upstream") };
}

describe("GET /v1/challenges: the player's own progress", () => {
  const app = useAttemptsApp();

  it("shows nothing for a challenge never attempted", async () => {
    const { entry } = await nginx502(await player(app, randomUUID()));
    expect(entry?.progress).toEqual({ status: null, finished_attempts: 0, best_solve_ms: null, active_attempt_id: null, last_finished_attempt_id: null });
  });

  it("shows a running attempt as in progress, then a solve with its time", async () => {
    const user = await player(app, randomUUID());
    const id = await readyAttempt(app, user);
    expect((await nginx502(user)).entry?.progress).toMatchObject({ status: "in_progress", active_attempt_id: id });
    app().engine.answers.push(PASSED);
    await user.check(id);
    const { list, entry } = await nginx502(user);
    expect(entry?.progress).toMatchObject({ status: "solved", finished_attempts: 1, active_attempt_id: null, last_finished_attempt_id: id });
    expect(entry?.progress.best_solve_ms).toBeGreaterThanOrEqual(0);
    expect(list.catalog.solved).toBe(1);
    expect((await nginx502(user, "&status=solved")).list.challenges.map((card) => card.slug)).toEqual(["nginx-502-upstream"]);
    expect((await nginx502(user, "&status=unsolved")).entry).toBeUndefined();
  });

  it("shows an attempt given up as failed, for that player only", async () => {
    const user = await player(app, randomUUID());
    const id = await readyAttempt(app, user);
    await user.abandon(id);
    await waitForStatus(user, id, "abandoned");
    const { list, entry } = await nginx502(user);
    expect(entry?.progress).toMatchObject({ status: "failed", finished_attempts: 1, last_finished_attempt_id: id });
    expect(list.catalog).toMatchObject({ failed: 1, solved: 0, flagged: 0 });
    expect((await nginx502(user, "&status=failed")).entry).toBeDefined();
    expect((await nginx502(await player(app, randomUUID()))).entry?.progress.status).toBeNull();
  });
});
