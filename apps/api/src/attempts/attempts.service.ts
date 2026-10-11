import { randomBytes } from "node:crypto";
import { attempts } from "@greenbuild/db";
import { type AttemptResponse, ConflictError, SEED_MAX } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { LiveVersions } from "../challenges/live-versions.js";
import { violatesUnique } from "../infra/postgres-errors.js";
import { DatabaseClient } from "../infra/services.js";
import { activeAttemptId } from "./attempt-reader.js";
import { type AttemptRow, toResponse } from "./attempt-response.js";
import { finishAttempt } from "./finished-events.js";
import { SandboxRequests } from "./sandbox-requests.js";

const ONE_ACTIVE_ATTEMPT = "attempts_one_active_per_user";

interface StartedAttempt extends AttemptRow {
  seed: number;
}

@Injectable()
export class AttemptsService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly liveVersions: LiveVersions,
    private readonly sandboxes: SandboxRequests,
  ) {}

  // start records the attempt, then asks the engine for a sandbox. If the request cannot be
  // queued, the attempt is marked failed so it does not block the user's next one.
  async start(userId: string, challengeSlug: string): Promise<AttemptResponse> {
    const version = await this.liveVersions.latest(challengeSlug);
    const context = (await this.liveVersions.isTodaysDaily(version.id)) ? "daily" : "catalog";
    const attempt = await this.insert(userId, version.id, context);
    try {
      await this.sandboxes.request(attempt, version);
    } catch (error) {
      await this.database.db.transaction((tx) => finishAttempt(tx, { attemptId: attempt.id, from: ["starting"], to: "failed" }));
      throw error;
    }
    return toResponse(attempt, challengeSlug);
  }

  private async insert(userId: string, challengeVersionId: string, context: "daily" | "catalog"): Promise<StartedAttempt> {
    try {
      const [attempt] = await this.database.db
        .insert(attempts)
        .values({ userId, challengeVersionId, seed: randomSeed(), context })
        .returning({
          id: attempts.id,
          seed: attempts.seed,
          status: attempts.status,
          createdAt: attempts.createdAt,
          startedAt: attempts.startedAt,
          checksUsed: attempts.checksUsed,
        });
      if (!attempt) {
        throw new Error("insert attempt returned no row");
      }
      return attempt;
    } catch (error) {
      if (violatesUnique(error, ONE_ACTIVE_ATTEMPT)) {
        // The active attempt may end in between; then the 409 carries no id.
        const activeId = await activeAttemptId(this.database.db, userId);
        throw new ConflictError("Another attempt is still active", activeId ? { active_attempt_id: activeId } : undefined);
      }
      throw error;
    }
  }
}

// randomSeed stays within 2^53-1, the largest seed the queue contract and JSON numbers carry exactly.
function randomSeed(): number {
  return Number(randomBytes(8).readBigUInt64BE() & BigInt(SEED_MAX));
}
