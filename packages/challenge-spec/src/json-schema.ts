import { challengeManifestSchema } from "@greenbuild/shared";
import { z } from "zod";

// manifestJsonSchema is challengeManifestSchema for editors: what a challenge.yaml may contain.
// Input mode, so keys with defaults are optional to write. Cross-field rules (skill weights adding
// up to 1, range order) stay in zod and are checked by pnpm challenges:validate.
export function manifestJsonSchema(): Record<string, unknown> {
  return { title: "greenbuild challenge.yaml", ...z.toJSONSchema(challengeManifestSchema, { io: "input", target: "draft-2020-12" }) };
}

export function manifestJsonSchemaText(): string {
  return `${JSON.stringify(manifestJsonSchema(), null, 2)}\n`;
}
