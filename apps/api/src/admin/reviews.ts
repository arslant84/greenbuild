import { and, attempts, attemptSignals, auditLog, challenges, challengeVersions, cheatReviews, eq, inArray, sql, users } from "@greenbuild/db";
import { ConflictError, NotFoundError, type ReviewQueue, type ReviewRequest, type ReviewResponse } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { AttemptEvents, type Transaction } from "../attempts/finished-events.js";
import { DatabaseClient } from "../infra/services.js";

const QUEUE_LIMIT = 100;

// Reviews decides on flagged attempts (architecture.md, "Наказания", task 49c): clear sends the attempt
// back to be rated, void keeps it out of the rating and takes back its XP, ban also bans the account. Each decision is
// written to audit_log in the same transaction.
@Injectable()
export class Reviews {
  constructor(
    private readonly database: DatabaseClient,
    private readonly events: AttemptEvents,
  ) {}

  async queue(): Promise<ReviewQueue> {
    const { db } = this.database;
    const flagged = await db
      .select({ id: attempts.id, userId: attempts.userId, handle: users.handle, slug: challenges.slug, status: attempts.status, finishedAt: attempts.finishedAt })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.userId))
      .innerJoin(challengeVersions, eq(challengeVersions.id, attempts.challengeVersionId))
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .leftJoin(cheatReviews, eq(cheatReviews.attemptId, attempts.id))
      .where(and(eq(attempts.flagged, true), sql`${cheatReviews.id} is null`))
      .orderBy(attempts.finishedAt)
      .limit(QUEUE_LIMIT);
    const signals = flagged.length === 0 ? [] : await db.select().from(attemptSignals).where(inArray(attemptSignals.attemptId, flagged.map((row) => row.id)));
    return {
      attempts: flagged.map((row) => ({
        attempt_id: row.id,
        user_id: row.userId,
        handle: row.handle,
        challenge_slug: row.slug,
        status: row.status,
        finished_at: row.finishedAt?.toISOString() ?? null,
        signals: signals.filter((found) => found.attemptId === row.id).map(({ signal, value, weight }) => ({ signal, value, weight })),
      })),
    };
  }

  async decide(reviewerId: string, attemptId: string, request: ReviewRequest): Promise<ReviewResponse> {
    await this.database.db.transaction(async (tx) => {
      const [attempt] = await tx.select({ userId: attempts.userId, flagged: attempts.flagged }).from(attempts).where(eq(attempts.id, attemptId)).for("update");
      if (!attempt?.flagged) {
        throw new NotFoundError("No flagged attempt with this id");
      }
      const [review] = await tx.insert(cheatReviews).values({ attemptId, reviewerId, decision: request.decision, note: request.note }).onConflictDoNothing().returning();
      if (!review) {
        throw new ConflictError("This attempt is already reviewed");
      }
      await apply(tx, { attemptId, userId: attempt.userId, decision: request.decision }, this.events);
      await tx.insert(auditLog).values({ actorId: reviewerId, action: `review.${request.decision}`, targetType: "attempt", targetId: attemptId, details: { note: request.note ?? null } });
    });
    return { attempt_id: attemptId, decision: request.decision };
  }
}

interface Decision {
  attemptId: string;
  userId: string;
  decision: ReviewRequest["decision"];
}

// apply carries out a decision: clear unflags the attempt; void leaves it flagged; ban leaves it
// flagged and bans the account. Each sends attempt.finished again, so the worker rates a cleared
// attempt and takes back a voided one's XP.
async function apply(tx: Transaction, { attemptId, userId, decision }: Decision, events: AttemptEvents): Promise<void> {
  if (decision === "clear") {
    await tx.update(attempts).set({ flagged: false }).where(eq(attempts.id, attemptId));
  }
  if (decision === "ban") {
    await tx.update(users).set({ status: "banned" }).where(eq(users.id, userId));
  }
  await events.republishFinished(tx, attemptId);
}
