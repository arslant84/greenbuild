import type { ChallengeCard } from "@greenbuild/shared";
import { z } from "zod";
import type { LiveVersion } from "./live-versions.js";

// The parts of a manifest the player sees; skills map a name to its weight.
const cardManifestSchema = z.object({
  title: z.string().min(1),
  statement: z.string().min(1),
  difficulty: z.number().int().min(1).max(10),
  skills: z.record(z.string(), z.number()).default({}),
  time_limit_sec: z.number().int().positive(),
});

// challengeCard throws for a manifest it cannot read: the challenge pipeline should never publish one.
export function challengeCard(slug: string, version: LiveVersion): ChallengeCard {
  const manifest = cardManifestSchema.parse(version.specJson);
  return {
    slug,
    version: version.version,
    title: manifest.title,
    statement: manifest.statement,
    difficulty: manifest.difficulty,
    skills: Object.keys(manifest.skills),
    time_limit_sec: manifest.time_limit_sec,
  };
}
