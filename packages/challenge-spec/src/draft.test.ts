import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type DraftModel, draftChallenge } from "./draft.js";
import { REQUIRED_FILES } from "./validate.js";

// architecture.md, task 53: pnpm challenges:draft writes the model's draft as a new source: ai folder.
const REPO = fileURLToPath(new URL("../../../", import.meta.url));
let root = "";
let challengesDir = "";

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "greenbuild-draft-"));
  challengesDir = join(root, "challenges");
  await cp(join(REPO, "challenges", "etc-hosts-stale"), join(challengesDir, "etc-hosts-stale"), { recursive: true });
  await mkdir(join(root, "docs", "runbooks"), { recursive: true });
  await cp(join(REPO, "docs", "runbooks", "challenge-authoring.md"), join(root, "docs", "runbooks", "challenge-authoring.md"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// answering is a fake model that records the prompt and answers with the example challenge as id.
async function answering(id: string, source: string): Promise<{ model: DraftModel; prompts: string[] }> {
  const files: Record<string, string> = {};
  for (const name of REQUIRED_FILES) {
    files[name] = await readFile(join(challengesDir, "etc-hosts-stale", name), "utf8");
  }
  files["challenge.yaml"] = (files["challenge.yaml"] ?? "").replace("id: etc-hosts-stale", `id: ${id}`).replace(/^source: .*$/m, `source: ${source}`);
  const prompts: string[] = [];
  return {
    prompts,
    model: {
      complete: (prompt) => {
        prompts.push(prompt);
        return Promise.resolve(`Here is the draft:\n${JSON.stringify({ files })}`);
      },
    },
  };
}

describe("draftChallenge", () => {
  it("writes a valid draft from the brief, the guide and the example", async () => {
    const { model, prompts } = await answering("dns-cache-stale", "ai");

    const { dir, errors } = await draftChallenge({ challengesDir, id: "dns-cache-stale", brief: "A stale DNS cache entry", model });
    expect(errors).toEqual([]);
    expect(await readFile(join(dir, "check.sh"), "utf8")).toContain("the site is back");
    expect(prompts[0]).toContain("A stale DNS cache entry");
    expect(prompts[0]).toContain("One problem per challenge");
  });

  it("reports a draft that does not say source: ai", async () => {
    const { model } = await answering("dns-cache-stale", "human");

    expect((await draftChallenge({ challengesDir, id: "dns-cache-stale", brief: "b", model })).errors).toEqual(["challenge.yaml must have id dns-cache-stale and source: ai"]);
  });

  it("refuses an answer that is not the asked JSON and an existing folder", async () => {
    const garbage: DraftModel = { complete: () => Promise.resolve("I cannot help with that.") };

    await expect(draftChallenge({ challengesDir, id: "dns-cache-stale", brief: "b", model: garbage })).rejects.toThrow("not the JSON");
    await expect(draftChallenge({ challengesDir, id: "etc-hosts-stale", brief: "b", model: garbage })).rejects.toThrow("already exists");
  });
});
