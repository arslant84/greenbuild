import { and, attempts, challenges, challengeVersions, desc, eq, inArray, sql, xpLedger } from "@greenbuild/db";
import { type AttemptHistoryResponse, FINISHED_ATTEMPT_STATUSES } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient } from "../infra/services.js";

// AttemptHistory reads a player's finished attempts with the XP the worker credited for each.
@Injectable()
export class AttemptHistory {
  constructor(private readonly database: DatabaseClient) {}

  async list(userId: string, limit: number): Promise<AttemptHistoryResponse> {
    const rows = await this.database.db
      .select({
        id: attempts.id,
        slug: challenges.slug,
        title: challenges.title,
        context: attempts.context,
        status: attempts.status,
        createdAt: attempts.createdAt,
        finishedAt: attempts.finishedAt,
        durationMs: attempts.durationMs,
        hintsUsed: attempts.hintsUsed,
        xp: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int`,
      })
      .from(attempts)
      .innerJoin(challengeVersions, eq(challengeVersions.id, attempts.challengeVersionId))
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .leftJoin(xpLedger, eq(xpLedger.attemptId, attempts.id))
      .where(and(eq(attempts.userId, userId), inArray(attempts.status, [...FINISHED_ATTEMPT_STATUSES])))
      .groupBy(attempts.id, challenges.slug, challenges.title)
      .orderBy(desc(attempts.createdAt))
      .limit(limit);
    return {
      attempts: rows.map((row) => ({
        id: row.id,
        challenge_slug: row.slug,
        challenge_title: row.title,
        context: row.context,
        status: finishedStatus(row.status),
        created_at: row.createdAt.toISOString(),
        finished_at: row.finishedAt?.toISOString() ?? null,
        duration_ms: row.durationMs,
        hints_used: row.hintsUsed,
        xp_earned: row.xp,
      })),
    };
  }
}

type FinishedStatus = (typeof FINISHED_ATTEMPT_STATUSES)[number];

// The query keeps finished attempts only; this narrows the column's type to match.
function finishedStatus(status: string): FinishedStatus {
  const finished = FINISHED_ATTEMPT_STATUSES.find((known) => known === status);
  if (!finished) {
    throw new Error(`attempt history: unexpected status ${status}`);
  }
  return finished;
}
