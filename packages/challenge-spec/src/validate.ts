import { access, readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { type ChallengeManifest, challengeManifestSchema } from "@greenbuild/shared";
import { parse } from "yaml";
import { parseHints } from "./hints.js";

// architecture.md "Challenge specification": every challenge folder holds these.
export const REQUIRED_FILES = ["challenge.yaml", "Dockerfile", "setup.sh", "check.sh", "solution.sh", "hints.md", "README.md"] as const;

export interface ChallengeReport {
  id: string;
  errors: string[];
  // Set once challenge.yaml parsed and passed the schema, with defaults filled in.
  manifest?: ChallengeManifest;
  // The texts of hints.md, weakest first; set with manifest.
  hints?: string[];
}

type ManifestResult = { manifest: ChallengeManifest } | { errors: string[] };

// validateChallenge checks one challenge folder; an empty errors list means it may go to CI's runs.
export async function validateChallenge(dir: string): Promise<ChallengeReport> {
  const id = basename(dir);
  const missing = await missingFiles(dir);
  if (missing.length > 0) {
    return { id, errors: missing.map((file) => `${file} is missing`) };
  }
  const result = await loadManifest(join(dir, "challenge.yaml"));
  if ("errors" in result) {
    return { id, errors: result.errors };
  }
  const hints = parseHints(await readFile(join(dir, "hints.md"), "utf8"));
  const errors = [...idErrors(id, result.manifest), ...hintErrors(hints, result.manifest)];
  return { id, errors, manifest: result.manifest, hints };
}

// validateAll checks every folder directly under root, in name order.
export async function validateAll(root: string): Promise<ChallengeReport[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  return Promise.all(dirs.map((name) => validateChallenge(join(root, name))));
}

async function missingFiles(dir: string): Promise<string[]> {
  const present = await Promise.all(REQUIRED_FILES.map((file) => exists(join(dir, file))));
  return REQUIRED_FILES.filter((_file, index) => !present[index]);
}

async function loadManifest(path: string): Promise<ManifestResult> {
  let document: unknown;
  try {
    document = parse(await readFile(path, "utf8"));
  } catch (error) {
    return { errors: [`challenge.yaml is not valid YAML: ${String(error)}`] };
  }
  const parsed = challengeManifestSchema.safeParse(document);
  return parsed.success ? { manifest: parsed.data } : { errors: parsed.error.issues.map(formatIssue) };
}

function idErrors(folder: string, manifest: ChallengeManifest): string[] {
  return manifest.id === folder ? [] : [`id "${manifest.id}" must match the folder name "${folder}"`];
}

function hintErrors(hints: string[], manifest: ChallengeManifest): string[] {
  if (hints.includes("")) {
    return ['hints.md has an empty "## Hint N" section'];
  }
  return hints.length === manifest.hints ? [] : [`hints: ${manifest.hints} in challenge.yaml, but hints.md has ${hints.length} "## Hint N" sections`];
}

function formatIssue(issue: { path: PropertyKey[]; message: string }): string {
  const path = issue.path.map(String).join(".");
  return path ? `challenge.yaml ${path}: ${issue.message}` : `challenge.yaml: ${issue.message}`;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
