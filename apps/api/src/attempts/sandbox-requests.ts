import { QUEUE_PAYLOAD_FIELD, QUEUE_VERSION, STREAM_SANDBOX_CREATE, sandboxCreateSchema } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import type { LiveVersion } from "../challenges/live-versions.js";
import { RedisClient } from "../infra/services.js";
import { launchPlan } from "./launch-plan.js";

// The engine acks what it reads; the cap only bounds a stream nobody consumes.
const CREATE_STREAM_MAX_LENGTH = 100_000;

// SandboxRequests asks the engine for an attempt's sandbox through sandbox.create, sized from the manifest.
@Injectable()
export class SandboxRequests {
  constructor(private readonly redis: RedisClient) {}

  async request(attempt: { id: string; seed: number }, version: LiveVersion): Promise<void> {
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
