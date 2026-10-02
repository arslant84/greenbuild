import { UnavailableError } from "@greenbuild/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { z } from "zod";
import type { ServicesEnv } from "../config/services-env.js";
import { SERVICES_ENV } from "../infra/services.js";

// The engine gives its checker 20 s; this leaves room for copying it in and the round trip.
const CHECK_TIMEOUT_MS = 30_000;

const engineCheckSchema = z.object({
  passed: z.boolean(),
  output_tail: z.string(),
  duration_ms: z.number().int().nonnegative(),
});

export type EngineCheck = z.infer<typeof engineCheckSchema>;

export interface CheckRequest {
  attemptId: string;
  sandboxId: string;
  challengeId: string;
}

// EngineClient calls the engine's internal API (architecture.md: the API never controls containers
// itself). Every failure becomes UnavailableError; the details go to the log, not to the player.
@Injectable()
export class EngineClient {
  private readonly logger = new Logger(EngineClient.name);
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(@Inject(SERVICES_ENV) env: ServicesEnv) {
    this.baseUrl = env.ENGINE_INTERNAL_URL.replace(/\/$/, "");
    this.token = env.ENGINE_INTERNAL_TOKEN;
  }

  async check(request: CheckRequest): Promise<EngineCheck> {
    try {
      const response = await fetch(`${this.baseUrl}/internal/attempts/${encodeURIComponent(request.attemptId)}/check`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
        body: JSON.stringify({ sandbox_id: request.sandboxId, challenge_id: request.challengeId }),
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`answered ${response.status}`);
      }
      return engineCheckSchema.parse(await response.json());
    } catch (error) {
      this.logger.error(`engine check for attempt ${request.attemptId} failed: ${String(error)}`);
      throw new UnavailableError("The check could not run");
    }
  }
}
