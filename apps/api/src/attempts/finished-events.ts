import { and, attempts, type Database, eq, inArray, outbox } from "@greenbuild/db";
import { type AttemptResponse, attemptFinishedSchema, FINISHED_ATTEMPT_STATUSES, QUEUE_VERSION, STREAM_ATTEMPT_FINISHED } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

interface Finish {
  attemptId: string;
  // The statuses the attempt may still be in; any other status means it already ended.
  from: readonly AttemptResponse["status"][];
  to: (typeof FINISHED_ATTEMPT_STATUSES)[number];
  finishedAt?: Date;
  durationMs?: number | null;
}

// finishAttempt moves an attempt to its final status and records attempt.finished in the outbox,
// both in the caller's transaction, so the event exists exactly when the change does. It returns
// false, and writes nothing, when the attempt was no longer in one of `from`.
export async function finishAttempt(tx: Transaction, finish: Finish): Promise<boolean> {
  const [row] = await tx
    .update(attempts)
    .set({ status: finish.to, finishedAt: finish.finishedAt ?? new Date(), ...(finish.durationMs === undefined ? {} : { durationMs: finish.durationMs }) })
    .where(and(eq(attempts.id, finish.attemptId), inArray(attempts.status, [...finish.from])))
    .returning(FINISHED_COLUMNS);
  if (!row) {
    return false;
  }
  await recordFinished(tx, finish.attemptId, { ...row, status: finish.to });
  return true;
}

const FINISHED_COLUMNS = {
  userId: attempts.userId,
  challengeVersionId: attempts.challengeVersionId,
  durationMs: attempts.durationMs,
  checksUsed: attempts.checksUsed,
  finishedAt: attempts.finishedAt,
};

interface FinishedRow {
  userId: string;
  challengeVersionId: string;
  durationMs: number | null;
  checksUsed: number;
  finishedAt: Date | null;
  status: (typeof FINISHED_ATTEMPT_STATUSES)[number];
}

async function recordFinished(tx: Transaction, attemptId: string, row: FinishedRow): Promise<void> {
  const event = attemptFinishedSchema.parse({
    version: QUEUE_VERSION,
    attempt_id: attemptId,
    user_id: row.userId,
    challenge_version_id: row.challengeVersionId,
    status: row.status,
    ...(row.durationMs === null ? {} : { duration_ms: row.durationMs }),
    checks_used: row.checksUsed,
    finished_at: (row.finishedAt ?? new Date()).toISOString(),
  });
  await tx.insert(outbox).values({ topic: STREAM_ATTEMPT_FINISHED, payload: event });
}

// AttemptEvents lets other modules ask for an ended attempt's attempt.finished again, in their
// transaction: a review that clears a flagged attempt sends it back to be rated (task 49c). The worker's
// jobs are idempotent, so only the rating, which skipped the flagged attempt, changes anything.
@Injectable()
export class AttemptEvents {
  async republishFinished(tx: Transaction, attemptId: string): Promise<void> {
    const [row] = await tx
      .select({ ...FINISHED_COLUMNS, status: attempts.status })
      .from(attempts)
      .where(and(eq(attempts.id, attemptId), inArray(attempts.status, [...FINISHED_ATTEMPT_STATUSES])));
    if (!row) {
      throw new Error(`republish attempt.finished: attempt ${attemptId} has not ended`);
    }
    await recordFinished(tx, attemptId, { ...row, status: row.status as FinishedRow["status"] });
  }
}
