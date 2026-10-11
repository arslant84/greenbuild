import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { exists } from "./exists.js";
import { REQUIRED_FILES, validateChallenge } from "./validate.js";

// The model that drafts challenges; the latest Claude model when task 53 was written.
const DRAFT_MODEL = "claude-opus-5-5";
const MAX_TOKENS = 16_000;
// A finished challenge the drafts follow, and the author's checklist they must meet.
const EXAMPLE_CHALLENGE = "etc-hosts-stale";
const GUIDE = join("..", "docs", "runbooks", "challenge-authoring.md");

// DraftModel turns a prompt into text; the Claude API in use, a fake in tests.
export interface DraftModel {
  complete(prompt: string): Promise<string>;
}

export function claudeModel(apiKey: string): DraftModel {
  const client = new Anthropic({ apiKey });
  return {
    async complete(prompt) {
      const message = await client.messages.create({ model: DRAFT_MODEL, max_tokens: MAX_TOKENS, messages: [{ role: "user", content: prompt }] });
      return message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    },
  };
}

const draftSchema = z.strictObject({ files: z.strictObject(Object.fromEntries(REQUIRED_FILES.map((name) => [name, z.string().min(1)]))) });

async function examplePrompt(challengesDir: string): Promise<string> {
  const files = await Promise.all(REQUIRED_FILES.map(async (name) => `--- ${name}\n${await readFile(join(challengesDir, EXAMPLE_CHALLENGE, name), "utf8")}`));
  return files.join("\n");
}

async function prompt(challengesDir: string, id: string, brief: string): Promise<string> {
  const guide = await readFile(join(challengesDir, GUIDE), "utf8");
  return [
    `Draft a greenbuild challenge with the id "${id}" from this brief:\n\n${brief}`,
    `Follow the author's guide:\n\n${guide}`,
    `Here is a finished challenge to match in structure and tone:\n\n${await examplePrompt(challengesDir)}`,
    `Answer with JSON only: {"files": {${REQUIRED_FILES.map((name) => `"${name}": "<content>"`).join(", ")}}}. In challenge.yaml set id: ${id}, version: 1 and source: ai.`,
  ].join("\n\n");
}

export interface DraftRequest {
  challengesDir: string;
  id: string;
  brief: string;
  model: DraftModel;
}

// draftChallenge asks the model for every file of a new challenge (task 53), writes them to a folder
// that must not exist yet, and returns the folder with the validator's findings. A draft is a start:
// the author fixes it until verify-challenge.sh passes.
export async function draftChallenge({ challengesDir, id, brief, model }: DraftRequest): Promise<{ dir: string; errors: string[] }> {
  const dir = join(challengesDir, id);
  if (await exists(dir)) {
    throw new Error(`challenges:draft: ${dir} already exists`);
  }
  const answer = await model.complete(await prompt(challengesDir, id, brief));
  const draft = draftSchema.safeParse(parseJson(answer.slice(answer.indexOf("{"), answer.lastIndexOf("}") + 1)));
  if (!draft.success) {
    throw new Error("challenges:draft: the model's answer is not the JSON the prompt asked for");
  }
  await mkdir(dir);
  for (const [name, content] of Object.entries(draft.data.files)) {
    await writeFile(join(dir, name), content, { mode: name.endsWith(".sh") ? 0o755 : 0o644 });
  }
  const report = await validateChallenge(dir);
  const errors = [...report.errors];
  if (report.manifest && (report.manifest.id !== id || report.manifest.source !== "ai")) {
    errors.push(`challenge.yaml must have id ${id} and source: ai`);
  }
  return { dir, errors };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
