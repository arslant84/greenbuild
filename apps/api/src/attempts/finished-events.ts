import { and, attempts, type Database, eq, inArray, outbox } from "@greenbuild/db";
import { type AttemptResponse, attemptFinishedSchema, type FINISHED_ATTEMPT_STATUSES, QUEUE_VERSION, STREAM_ATTEMPT_FINISHED } from "@greenbuild/shared";

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
    .returning({
      userId: attempts.userId,
      challengeVersionId: attempts.challengeVersionId,
      durationMs: attempts.durationMs,
      checksUsed: attempts.checksUsed,
      finishedAt: attempts.finishedAt,
    });
  if (!row) {
    return false;
  }
  const event = attemptFinishedSchema.parse({
    version: QUEUE_VERSION,
    attempt_id: finish.attemptId,
    user_id: row.userId,
    challenge_version_id: row.challengeVersionId,
    status: finish.to,
    ...(row.durationMs === null ? {} : { duration_ms: row.durationMs }),
    checks_used: row.checksUsed,
    finished_at: (row.finishedAt ?? new Date()).toISOString(),
  });
  await tx.insert(outbox).values({ topic: STREAM_ATTEMPT_FINISHED, payload: event });
  return true;
}
