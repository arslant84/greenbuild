import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { z } from "zod";
import { claudeModel, draftChallenge } from "./draft.js";

// Drafts a challenge with the Claude API: pnpm challenges:draft <id> --brief <file>
// Needs ANTHROPIC_API_KEY; the draft is written as source: ai and must pass verify-challenge.sh.
const { values, positionals } = parseArgs({ args: process.argv.slice(2), options: { brief: { type: "string" } }, allowPositionals: true });
const [root = "challenges", id] = positionals;
const key = z.string().min(1).safeParse(process.env.ANTHROPIC_API_KEY);
if (!id || !values.brief) {
  console.error("usage: pnpm challenges:draft <id> --brief <file>");
  process.exit(2);
}
if (!key.success) {
  console.error("challenges:draft: set ANTHROPIC_API_KEY");
  process.exit(2);
}
try {
  const { dir, errors } = await draftChallenge({ challengesDir: root, id, brief: await readFile(values.brief, "utf8"), model: claudeModel(key.data) });
  console.log(`drafted ${dir}; run bash challenges/verify-challenge.sh challenges/${id} and fix it until it passes`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exitCode = errors.length > 0 ? 1 : 0;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
