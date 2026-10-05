import { access, readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { type ChallengeManifest, challengeManifestSchema } from "@greenbuild/shared";
import { parse } from "yaml";

// architecture.md "Challenge specification": every challenge folder holds these.
export const REQUIRED_FILES = ["challenge.yaml", "Dockerfile", "setup.sh", "check.sh", "solution.sh", "hints.md", "README.md"] as const;
const HINT_HEADING = /^## Hint \d+[ \t]*$/gm;

export interface ChallengeReport {
  id: string;
  errors: string[];
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
  const errors = [...idErrors(id, result.manifest), ...(await hintErrors(dir, result.manifest))];
  return { id, errors };
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

async function hintErrors(dir: string, manifest: ChallengeManifest): Promise<string[]> {
  const headings = (await readFile(join(dir, "hints.md"), "utf8")).match(HINT_HEADING)?.length ?? 0;
  return headings === manifest.hints ? [] : [`hints: ${manifest.hints} in challenge.yaml, but hints.md has ${headings} "## Hint N" sections`];
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
