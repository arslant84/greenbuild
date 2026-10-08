import { randomUUID } from "node:crypto";
import { attempts, connect, eq } from "@greenbuild/db";
import { describe, expect, it } from "vitest";
import { player, useAttemptsApp } from "../testing/attempts-app.js";
import { engineReports, startedBy, statusMessage, waitForStatus } from "../testing/engine-status.js";

// architecture.md, task 33f: a sandbox the agent destroyed for using all of its CPU fails the
// attempt and flags it for review.
describe("a sandbox destroyed for abuse", () => {
  const app = useAttemptsApp();

  it("fails the attempt and flags it", async () => {
    const user = await player(app, randomUUID());
    const { id } = await startedBy(user);
    await engineReports(app, statusMessage({ attempt_id: id, status: "ready", sandbox_id: `sbx-${id}` }));
    await waitForStatus(user, id, "ready");
    await engineReports(app, statusMessage({ attempt_id: id, status: "destroyed", sandbox_id: `sbx-${id}`, reason: "abuse" }));

    await waitForStatus(user, id, "failed");
    const database = connect(app().env.DATABASE_URL);
    const [row] = await database.db.select({ flagged: attempts.flagged }).from(attempts).where(eq(attempts.id, id));
    await database.close();
    expect(row?.flagged).toBe(true);
  });
});
