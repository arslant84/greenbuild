import { and, attempts, eq, sandboxSessions } from "@greenbuild/db";
import { SANDBOX_REASON_ABUSE, type SandboxStatus } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { DatabaseClient } from "../infra/services.js";
import { finishAttempt, type Transaction } from "./finished-events.js";

// AttemptStatusUpdates applies what the engine reports. Each change only moves an attempt forward
// from the state it expects, so a repeated or late status changes nothing.
@Injectable()
export class AttemptStatusUpdates {
  constructor(private readonly database: DatabaseClient) {}

  async apply(status: SandboxStatus): Promise<void> {
    if (!z.uuid().safeParse(status.attempt_id).success) {
      return;
    }
    await this.database.db.transaction(async (tx) => {
      if (status.status === "ready") {
        await markReady(tx, status.attempt_id, status.sandbox_id ?? "");
      } else if (status.status === "failed") {
        await markFailed(tx, status.attempt_id, status.reason);
      } else {
        await markDestroyed(tx, status.attempt_id, status.reason);
      }
    });
  }
}

async function markReady(tx: Transaction, attemptId: string, sandboxId: string): Promise<void> {
  const moved = await tx
    .update(attempts)
    .set({ status: "ready", startedAt: new Date() })
    .where(and(eq(attempts.id, attemptId), eq(attempts.status, "starting")))
    .returning({ id: attempts.id });
  if (moved.length > 0) {
    await tx.insert(sandboxSessions).values({ attemptId, sandboxId, status: "ready" }).onConflictDoNothing();
  }
}

async function markFailed(tx: Transaction, attemptId: string, reason: string | undefined): Promise<void> {
  if (await finishAttempt(tx, { attemptId, from: ["starting"], to: "failed" })) {
    await tx.insert(sandboxSessions).values({ attemptId, status: "failed", exitReason: reason ?? null });
  }
}

// A sandbox that goes away while the attempt is still open ends it: the TTL ran out, or the agent
// killed it for using all of its CPU, which fails the attempt and flags it for review.
async function markDestroyed(tx: Transaction, attemptId: string, reason: string | undefined): Promise<void> {
  const now = new Date();
  await tx
    .update(sandboxSessions)
    .set({ status: "destroyed", destroyedAt: now, exitReason: reason ?? null })
    .where(and(eq(sandboxSessions.attemptId, attemptId), eq(sandboxSessions.status, "ready")));
  const abuse = reason === SANDBOX_REASON_ABUSE;
  const finished = await finishAttempt(tx, { attemptId, from: ["ready"], to: abuse ? "failed" : "expired", finishedAt: now });
  if (finished && abuse) {
    await tx.update(attempts).set({ flagged: true }).where(eq(attempts.id, attemptId));
  }
}
