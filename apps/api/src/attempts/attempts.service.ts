import { randomBytes } from "node:crypto";
import { and, attempts, challenges, challengeVersions, desc, eq, sandboxSessions } from "@greenbuild/db";
import {
  type AttemptResponse,
  ConflictError,
  NotFoundError,
  QUEUE_PAYLOAD_FIELD,
  QUEUE_VERSION,
  SEED_MAX,
  STREAM_SANDBOX_CREATE,
  sandboxCreateSchema,
} from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient, RedisClient } from "../infra/services.js";
import { AttachTokens } from "./attach-token.js";
import { launchPlan } from "./launch-plan.js";

const UNIQUE_VIOLATION = "23505";
const ONE_ACTIVE_ATTEMPT = "attempts_one_active_per_user";
// The engine acks what it reads; the cap only bounds a stream nobody consumes.
const CREATE_STREAM_MAX_LENGTH = 100_000;

interface LiveVersion {
  id: string;
  imageRef: string;
  specJson: unknown;
}

interface StartedAttempt {
  id: string;
  seed: number;
  status: AttemptResponse["status"];
  createdAt: Date;
}

@Injectable()
export class AttemptsService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly redis: RedisClient,
    private readonly attachTokens: AttachTokens,
  ) {}

  // start records the attempt, then asks the engine for a sandbox. If the request cannot be
  // queued, the attempt is marked failed so it does not block the user's next one.
  async start(userId: string, challengeSlug: string): Promise<AttemptResponse> {
    const version = await this.liveVersion(challengeSlug);
    const attempt = await this.insert(userId, version.id);
    try {
      await this.requestSandbox(attempt, version);
    } catch (error) {
      await this.database.db.update(attempts).set({ status: "failed" }).where(eq(attempts.id, attempt.id));
      throw error;
    }
    return toResponse(attempt, challengeSlug);
  }

  // find answers "not found" for another user's attempt too, so ids reveal nothing.
  // While the sandbox is ready, the answer carries a fresh attach token for the terminal.
  async find(userId: string, attemptId: string): Promise<AttemptResponse> {
    const [row] = await this.database.db
      .select({
        id: attempts.id,
        userId: attempts.userId,
        status: attempts.status,
        createdAt: attempts.createdAt,
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

  private async liveVersion(slug: string): Promise<LiveVersion> {
    const [version] = await this.database.db
      .select({ id: challengeVersions.id, imageRef: challengeVersions.imageRef, specJson: challengeVersions.specJson })
      .from(challengeVersions)
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .where(and(eq(challenges.slug, slug), eq(challenges.status, "live")))
      .orderBy(desc(challengeVersions.version))
      .limit(1);
    if (!version) {
      throw new NotFoundError("Challenge not found");
    }
    return version;
  }

  private async insert(userId: string, challengeVersionId: string): Promise<StartedAttempt> {
    try {
      const [attempt] = await this.database.db
        .insert(attempts)
        .values({ userId, challengeVersionId, seed: randomSeed(), context: "catalog" })
        .returning({ id: attempts.id, seed: attempts.seed, status: attempts.status, createdAt: attempts.createdAt });
      if (!attempt) {
        throw new Error("insert attempt returned no row");
      }
      return attempt;
    } catch (error) {
      if (violates(error, ONE_ACTIVE_ATTEMPT)) {
        throw new ConflictError("Another attempt is still active");
      }
      throw error;
    }
  }

  private async requestSandbox(attempt: StartedAttempt, version: LiveVersion): Promise<void> {
    const plan = launchPlan(version.specJson);
    const message = sandboxCreateSchema.parse({
      version: QUEUE_VERSION,
      attempt_id: attempt.id,
      image: version.imageRef,
      seed: attempt.seed,
      cpu_millis: plan.cpuMillis,
      memory_bytes: plan.memoryBytes,
      ttl_seconds: plan.ttlSeconds,
      network: plan.network,
      capabilities: plan.capabilities,
    });
    const client = await this.redis.connected();
    await client.xAdd(STREAM_SANDBOX_CREATE, "*", { [QUEUE_PAYLOAD_FIELD]: JSON.stringify(message) }, {
      TRIM: { strategy: "MAXLEN", strategyModifier: "~", threshold: CREATE_STREAM_MAX_LENGTH },
    });
  }
}

// randomSeed stays within 2^53-1, the largest seed the queue contract and JSON numbers carry exactly.
function randomSeed(): number {
  return Number(randomBytes(8).readBigUInt64BE() & BigInt(SEED_MAX));
}

// Drizzle wraps the driver's error, so the PostgreSQL code sits on the cause.
function violates(error: unknown, constraint: string): boolean {
  const cause = error instanceof Error && error.cause !== undefined ? error.cause : error;
  const details = cause as { code?: unknown; constraint_name?: unknown };
  return details.code === UNIQUE_VIOLATION && details.constraint_name === constraint;
}

function toResponse(attempt: Pick<StartedAttempt, "id" | "status" | "createdAt">, challengeSlug: string): AttemptResponse {
  return { id: attempt.id, status: attempt.status, challenge_slug: challengeSlug, created_at: attempt.createdAt.toISOString() };
}
