import { and, attemptChecks, attempts, challenges, challengeVersions, eq, sandboxSessions, sql } from "@greenbuild/db";
import { ATTEMPT_MAX_CHECKS, type AttemptResult, type CheckResponse, ConflictError, NotFoundError, RateLimitedError } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { EngineClient, type EngineCheck } from "../engine/engine-client.js";
import { DatabaseClient } from "../infra/services.js";

interface CheckTarget {
  sandboxId: string;
  challengeSlug: string;
  startedAt: Date | null;
  checksUsed: number;
}

@Injectable()
export class ChecksService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly engine: EngineClient,
  ) {}

  // check spends one of the attempt's checks before the engine runs it, so parallel requests cannot
  // exceed the limit. A check the engine could not run is given back.
  async check(userId: string, attemptId: string): Promise<CheckResponse> {
    const target = await this.reserve(userId, attemptId);
    let result: EngineCheck;
    try {
      result = await this.engine.check({ attemptId, sandboxId: target.sandboxId, challengeId: target.challengeSlug });
    } catch (error) {
      await this.database.db
        .update(attempts)
        .set({ checksUsed: sql`${attempts.checksUsed} - 1` })
        .where(and(eq(attempts.id, attemptId), sql`${attempts.checksUsed} > 0`));
      throw error;
    }
    await this.record(attemptId, target, result);
    return { ...result, checks_left: ATTEMPT_MAX_CHECKS - target.checksUsed };
  }

  async result(userId: string, attemptId: string): Promise<AttemptResult> {
    const [attempt] = await this.database.db
      .select({ id: attempts.id, userId: attempts.userId, status: attempts.status, checksUsed: attempts.checksUsed, durationMs: attempts.durationMs, finishedAt: attempts.finishedAt, slug: challenges.slug })
      .from(attempts)
      .innerJoin(challengeVersions, eq(challengeVersions.id, attempts.challengeVersionId))
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .where(eq(attempts.id, attemptId));
    if (!attempt || attempt.userId !== userId) {
      throw new NotFoundError("Attempt not found");
    }
    const checks = await this.database.db.select().from(attemptChecks).where(eq(attemptChecks.attemptId, attemptId)).orderBy(attemptChecks.createdAt);
    return {
      id: attempt.id,
      status: attempt.status,
      challenge_slug: attempt.slug,
      checks_used: attempt.checksUsed,
      duration_ms: attempt.durationMs,
      finished_at: attempt.finishedAt?.toISOString() ?? null,
      checks: checks.map((check) => ({ passed: check.passed, output_tail: check.outputTail, duration_ms: check.durationMs, checked_at: check.createdAt.toISOString() })),
    };
  }

  private async reserve(userId: string, attemptId: string): Promise<CheckTarget> {
    const [attempt] = await this.database.db
      .select({ userId: attempts.userId, status: attempts.status, startedAt: attempts.startedAt, slug: challenges.slug, sandboxId: sandboxSessions.sandboxId })
      .from(attempts)
      .innerJoin(challengeVersions, eq(challengeVersions.id, attempts.challengeVersionId))
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .leftJoin(sandboxSessions, and(eq(sandboxSessions.attemptId, attempts.id), eq(sandboxSessions.status, "ready")))
      .where(eq(attempts.id, attemptId));
    if (!attempt || attempt.userId !== userId) {
      throw new NotFoundError("Attempt not found");
    }
    if (attempt.status !== "ready" || !attempt.sandboxId) {
      throw new ConflictError("The attempt has no running sandbox");
    }
    const [spent] = await this.database.db
      .update(attempts)
      .set({ checksUsed: sql`${attempts.checksUsed} + 1` })
      .where(and(eq(attempts.id, attemptId), eq(attempts.status, "ready"), sql`${attempts.checksUsed} < ${ATTEMPT_MAX_CHECKS}`))
      .returning({ checksUsed: attempts.checksUsed });
    if (!spent) {
      throw new RateLimitedError(`All ${ATTEMPT_MAX_CHECKS} checks are used`);
    }
    return { sandboxId: attempt.sandboxId, challengeSlug: attempt.slug, startedAt: attempt.startedAt, checksUsed: spent.checksUsed };
  }

  // record keeps the run; a pass solves the attempt, timed from the sandbox being ready.
  private async record(attemptId: string, target: CheckTarget, result: EngineCheck): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      await tx.insert(attemptChecks).values({ attemptId, passed: result.passed, outputTail: result.output_tail, durationMs: result.duration_ms });
      if (!result.passed) {
        return;
      }
      const finishedAt = new Date();
      const durationMs = target.startedAt ? finishedAt.getTime() - target.startedAt.getTime() : null;
      await tx
        .update(attempts)
        .set({ status: "solved", finishedAt, durationMs })
        .where(and(eq(attempts.id, attemptId), eq(attempts.status, "ready")));
    });
  }
}
