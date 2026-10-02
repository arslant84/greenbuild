import { and, attempts, challenges, challengeVersions, eq, sandboxSessions } from "@greenbuild/db";
import { type AttemptResponse, NotFoundError } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient } from "../infra/services.js";
import { AttachTokens } from "./attach-token.js";
import { toResponse } from "./attempt-response.js";

@Injectable()
export class AttemptReader {
  constructor(
    private readonly database: DatabaseClient,
    private readonly attachTokens: AttachTokens,
  ) {}

  // find answers "not found" for another user's attempt too, so ids reveal nothing.
  // While the sandbox is ready, the answer carries a fresh attach token for the terminal.
  async find(userId: string, attemptId: string): Promise<AttemptResponse> {
    const [row] = await this.database.db
      .select({
        id: attempts.id,
        userId: attempts.userId,
        status: attempts.status,
        createdAt: attempts.createdAt,
        startedAt: attempts.startedAt,
        checksUsed: attempts.checksUsed,
        slug: challenges.slug,
        sandboxId: sandboxSessions.sandboxId,
      })
      .from(attempts)
      .innerJoin(challengeVersions, eq(challengeVersions.id, attempts.challengeVersionId))
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .leftJoin(sandboxSessions, and(eq(sandboxSessions.attemptId, attempts.id), eq(sandboxSessions.status, "ready")))
      .where(eq(attempts.id, attemptId));
    if (!row || row.userId !== userId) {
      throw new NotFoundError("Attempt not found");
    }
    const response = toResponse(row, row.slug);
    if (row.status !== "ready" || !row.sandboxId) {
      return response;
    }
    return { ...response, attach_token: await this.attachTokens.sign({ sandboxId: row.sandboxId, attemptId: row.id, userId }) };
  }
}
