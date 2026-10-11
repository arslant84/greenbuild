import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scaffoldChallenge } from "./scaffold.js";
import { validateAll } from "./validate.js";

// architecture.md, task 53: pnpm challenges:new <id> starts a folder that passes challenges:validate.
let root = "";

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("scaffoldChallenge", () => {
  it("creates a folder that passes validation", async () => {
    root = await mkdtemp(join(tmpdir(), "greenbuild-challenges-"));
    await scaffoldChallenge(root, "disk-full-logs");

    const [report] = await validateAll(root);
    expect(report).toMatchObject({ id: "disk-full-logs", errors: [] });
  });

  it("refuses an existing folder and an invalid id", async () => {
    root = await mkdtemp(join(tmpdir(), "greenbuild-challenges-"));
    await scaffoldChallenge(root, "taken");

    await expect(scaffoldChallenge(root, "taken")).rejects.toThrow("already exists");
    await expect(scaffoldChallenge(root, "Not Valid")).rejects.toThrow("not a valid challenge id");
  });
});
