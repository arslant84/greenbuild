import { SANDBOX_CAPABILITIES } from "@greenbuild/shared";
import { z } from "zod";

const MILLICORES_PER_CPU = 1000;
const BYTES_PER_UNIT = { Mi: 1024 ** 2, Gi: 1024 ** 3 } as const;

// The parts of a challenge manifest (challenge_versions.spec_json) that size its sandbox.
const manifestSchema = z.object({
  time_limit_sec: z.number().int().positive(),
  resources: z.object({
    cpu: z.string().regex(/^(\d+m|\d+(\.\d+)?)$/),
    memory: z.string().regex(/^\d+(Mi|Gi)$/),
  }),
  network: z.literal("none"),
  capabilities: z.array(z.enum(SANDBOX_CAPABILITIES)).default([]),
});

export interface LaunchPlan {
  cpuMillis: number;
  memoryBytes: number;
  ttlSeconds: number;
  network: "none";
  capabilities: (typeof SANDBOX_CAPABILITIES)[number][];
}

// launchPlan reads Kubernetes-style quantities ("500m", "1", "512Mi", "1Gi") as the engine wants them.
// A manifest it cannot read throws: the challenge pipeline should never have published it.
export function launchPlan(spec: unknown): LaunchPlan {
  const manifest = manifestSchema.parse(spec);
  return {
    cpuMillis: cpuMillis(manifest.resources.cpu),
    memoryBytes: memoryBytes(manifest.resources.memory),
    ttlSeconds: manifest.time_limit_sec,
    network: manifest.network,
    capabilities: manifest.capabilities,
  };
}

function cpuMillis(quantity: string): number {
  if (quantity.endsWith("m")) {
    return Number.parseInt(quantity, 10);
  }
  return Math.round(Number.parseFloat(quantity) * MILLICORES_PER_CPU);
}

function memoryBytes(quantity: string): number {
  const unit = quantity.endsWith("Gi") ? "Gi" : "Mi";
  return Number.parseInt(quantity, 10) * BYTES_PER_UNIT[unit];
}
