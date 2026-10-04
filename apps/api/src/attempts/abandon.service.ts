import { attempts, eq } from "@greenbuild/db";
import { type AttemptResponse, ConflictError, NotFoundError } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient } from "../infra/services.js";
import { AttemptReader } from "./attempt-reader.js";
import { finishAttempt } from "./finished-events.js";
import { SandboxRequests } from "./sandbox-requests.js";

const OPEN_STATUSES = ["starting", "ready"] as const;

// AbandonService ends an attempt the player gives up on. The attempt is abandoned first, so the
// player can start again at once; the engine then destroys the sandbox in the background.
@Injectable()
export class AbandonService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly reader: AttemptReader,
    private readonly sandboxes: SandboxRequests,
  ) {}

  // abandon is safe to repeat: an abandoned attempt answers the same and asks for the destroy
  // again, so a retry after a queue error still reaches the engine.
  async abandon(userId: string, attemptId: string): Promise<AttemptResponse> {
    const [attempt] = await this.database.db
      .select({ userId: attempts.userId, status: attempts.status })
      .from(attempts)
      .where(eq(attempts.id, attemptId));
    if (!attempt || attempt.userId !== userId) {
      throw new NotFoundError("Attempt not found");
    }
    await this.database.db.transaction((tx) => finishAttempt(tx, { attemptId, from: OPEN_STATUSES, to: "abandoned" }));
    const current = await this.reader.find(userId, attemptId);
    if (current.status !== "abandoned") {
      throw new ConflictError("The attempt is already over");
    }
    await this.sandboxes.destroy(attemptId);
    return current;
  }
}
