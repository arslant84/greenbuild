import { z } from "zod";

const DEFAULT_ATTACH_URL = "ws://127.0.0.1:8080/attach";

const engineEnvSchema = z.object({
  ENGINE_ATTACH_URL: z.url({ protocol: /^wss?$/ }).default(DEFAULT_ATTACH_URL),
});

export interface EngineConfig {
  // The browser connects here directly, so it must be reachable from the player's machine.
  attachUrl: string;
}

// loadEngineConfig validates the environment once per request on the server; a bad value fails loudly.
export function loadEngineConfig(env: Record<string, string | undefined> = process.env): EngineConfig {
  const parsed = engineEnvSchema.parse({ ENGINE_ATTACH_URL: env.ENGINE_ATTACH_URL || undefined });
  return { attachUrl: parsed.ENGINE_ATTACH_URL };
}
