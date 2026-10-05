import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_FILES, validateAll, validateChallenge } from "../src/index.js";

const REPO_CHALLENGES = fileURLToPath(new URL("../../../challenges", import.meta.url));

const MANIFEST = `id: disk-full
version: 1
title: "The disk is full"
statement: "Writes fail. Free the disk."
difficulty: 3
skills: { linux: 1 }
time_limit_sec: 600
resources: { cpu: 250m, memory: 256Mi, disk: 1Gi }
network: none
check: { command: /opt/greenbuild/check.sh, timeout_sec: 20, run_as: root }
hints: 2
source: ai
`;
const HINTS = "# Hints\n\n## Hint 1\n\nLook at df.\n\n## Hint 2\n\nLook at du.\n";

const roots: string[] = [];

async function challengeDir(name: string, files: Partial<Record<(typeof REQUIRED_FILES)[number], string>> = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "challenge-spec-"));
  roots.push(root);
  const dir = join(root, name);
  await mkdir(dir);
  const contents = { "challenge.yaml": MANIFEST, "hints.md": HINTS, ...files };
  await Promise.all(REQUIRED_FILES.map((file) => writeFile(join(dir, file), contents[file as keyof typeof contents] ?? "#!/bin/sh\n")));
  return dir;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("validateChallenge", () => {
  it("accepts a complete challenge folder", async () => {
    expect(await validateChallenge(await challengeDir("disk-full"))).toMatchObject({ id: "disk-full", errors: [] });
  });

  it("names every missing file", async () => {
    const dir = await challengeDir("disk-full");
    await rm(join(dir, "check.sh"));
    await rm(join(dir, "README.md"));
    expect((await validateChallenge(dir)).errors).toEqual(["check.sh is missing", "README.md is missing"]);
  });

  it("reports YAML that does not parse", async () => {
    const { errors } = await validateChallenge(await challengeDir("disk-full", { "challenge.yaml": "id: [unclosed\n" }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^challenge.yaml is not valid YAML/);
  });

  it("reports schema problems with their path", async () => {
    const { errors } = await validateChallenge(await challengeDir("disk-full", { "challenge.yaml": MANIFEST.replace("difficulty: 3", "difficulty: 12") }));
    expect(errors).toEqual([expect.stringMatching(/^challenge.yaml difficulty: /)]);
  });

  it("requires the id to match the folder", async () => {
    expect((await validateChallenge(await challengeDir("disk-full-2"))).errors).toEqual(['id "disk-full" must match the folder name "disk-full-2"']);
  });

  it("requires as many hint sections as the manifest promises", async () => {
    const { errors } = await validateChallenge(await challengeDir("disk-full", { "hints.md": "# Hints\n\n## Hint 1\n\nLook at df.\n" }));
    expect(errors).toEqual(['hints: 2 in challenge.yaml, but hints.md has 1 "## Hint N" sections']);
  });
});

describe("validateAll", () => {
  it("passes every challenge in the repository", async () => {
    const reports = await validateAll(REPO_CHALLENGES);
    expect(reports.length).toBeGreaterThan(0);
    expect(reports.filter((report) => report.errors.length > 0)).toEqual([]);
  });
});

describe("the report of a valid folder", () => {
  it("carries the manifest with defaults filled in", async () => {
    const { manifest } = await validateChallenge(await challengeDir("disk-full"));
    expect(manifest).toMatchObject({ id: "disk-full", resources: { cpu: "250m", memory: "256Mi" }, capabilities: [], randomize: {} });
  });
});
