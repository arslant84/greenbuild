import { and, attempts, challengeVersions, eq, sql } from "@greenbuild/db";
import { ConflictError, type HintResponse, NotFoundError } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient } from "../infra/services.js";

// HintsService gives a running attempt its hints one at a time, weakest first.
@Injectable()
export class HintsService {
  constructor(private readonly database: DatabaseClient) {}

  // next takes the next hint in one UPDATE: the row lock makes parallel requests take turns, so no
  // hint is skipped or given twice.
  async next(userId: string, attemptId: string): Promise<HintResponse> {
    const [taken] = await this.database.db
      .update(attempts)
      .set({ hintsUsed: sql`${attempts.hintsUsed} + 1` })
      .from(challengeVersions)
      .where(
        and(
          eq(attempts.id, attemptId),
          eq(attempts.userId, userId),
          eq(attempts.status, "ready"),
          eq(challengeVersions.id, attempts.challengeVersionId),
          sql`${attempts.hintsUsed} < coalesce(jsonb_array_length(${challengeVersions.hintsJson}), 0)`,
        ),
      )
      .returning({ used: attempts.hintsUsed, hints: challengeVersions.hintsJson });
    if (!taken) {
      return this.refuse(userId, attemptId);
    }
    const hints = taken.hints ?? [];
    return { hint: hints[taken.used - 1] ?? "", number: taken.used, hints_left: hints.length - taken.used };
  }

  // refuse explains why no hint was taken: someone else's or a missing attempt is not found.
  private async refuse(userId: string, attemptId: string): Promise<never> {
    const [attempt] = await this.database.db.select({ userId: attempts.userId, status: attempts.status }).from(attempts).where(eq(attempts.id, attemptId));
    if (!attempt || attempt.userId !== userId) {
      throw new NotFoundError("Attempt not found");
    }
    throw new ConflictError(attempt.status === "ready" ? "No hints left" : "The attempt is not running");
  }
}
