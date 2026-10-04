import { randomUUID } from "node:crypto";
import { connect, outbox, sql } from "@greenbuild/db";
import { attemptFinishedSchema, STREAM_ATTEMPT_FINISHED } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { type AttemptsApp, player, useAttemptsApp } from "../testing/attempts-app.js";
import { engineReports, readyAttempt, startedBy, statusMessage, waitForStatus } from "../testing/engine-status.js";
import { finishAttempt } from "./finished-events.js";

const PASSED = { status: 200, body: { passed: true, output_tail: "the site is back\n", duration_ms: 120 } };

// The attempt.finished rows the outbox holds for one attempt.
async function finishedEvents(app: () => AttemptsApp, attemptId: string) {
  const connection = connect(app().env.DATABASE_URL);
  try {
    const rows = await connection.db.select().from(outbox).where(sql`${outbox.payload}->>'attempt_id' = ${attemptId}`);
    return rows.map((row) => ({ topic: row.topic, published: row.publishedAt !== null, event: attemptFinishedSchema.parse(row.payload) }));
  } finally {
    await connection.close();
  }
}

const app = useAttemptsApp();

describe("every final status writes one attempt.finished to the outbox", () => {
  it("solved", async () => {
    const user = await player(app, randomUUID());
    const id = await readyAttempt(app, user);
    app().engine.answers.push(PASSED);
    await user.check(id);
    expect((await user.check(id)).status).toBe(409);

    const events = await finishedEvents(app, id);
    expect(events).toMatchObject([{ topic: STREAM_ATTEMPT_FINISHED, published: false, event: { status: "solved", user_id: user.userId, checks_used: 1 } }]);
    expect(events[0]?.event.duration_ms).toEqual(expect.any(Number));
  });

  it("failed, when the engine cannot start the sandbox, once for a repeated status", async () => {
    const user = await player(app, randomUUID());
    const { id } = await startedBy(user);
    const failed = statusMessage({ attempt_id: id, status: "failed", reason: "sandbox could not be started (Unavailable)" });
    await engineReports(app, failed);
    await waitForStatus(user, id, "failed");
    await engineReports(app, failed);

    await new Promise((resolve) => setTimeout(resolve, 300));
    const events = await finishedEvents(app, id);
    expect(events).toMatchObject([{ event: { status: "failed", checks_used: 0 } }]);
    expect(events[0]?.event).not.toHaveProperty("duration_ms");
  });

  it("expired, when the engine reports the sandbox destroyed", async () => {
    const user = await player(app, randomUUID());
    const id = await readyAttempt(app, user);
    await engineReports(app, statusMessage({ attempt_id: id, status: "destroyed", sandbox_id: `sbx-${id}`, reason: "expired" }));
    await waitForStatus(user, id, "expired");

    expect(await finishedEvents(app, id)).toMatchObject([{ event: { status: "expired" } }]);
  });

  it("abandoned, once even when the player gives up twice", async () => {
    const user = await player(app, randomUUID());
    const id = await readyAttempt(app, user);
    await user.abandon(id);
    await user.abandon(id);

    expect(await finishedEvents(app, id)).toMatchObject([{ event: { status: "abandoned" } }]);
  });
});

describe("finishAttempt", () => {
  it("writes nothing when its transaction rolls back", async () => {
    const user = await player(app, randomUUID());
    const { id } = await startedBy(user);
    const connection = connect(app().env.DATABASE_URL);
    try {
      const rollback = connection.db.transaction(async (tx) => {
        await finishAttempt(tx, { attemptId: id, from: ["starting"], to: "failed" });
        throw new Error("roll back");
      });
      await expect(rollback).rejects.toThrow("roll back");
    } finally {
      await connection.close();
    }

    expect(await finishedEvents(app, id)).toEqual([]);
    expect(await (await user.find(id)).json()).toMatchObject({ status: "starting" });
  });
});
