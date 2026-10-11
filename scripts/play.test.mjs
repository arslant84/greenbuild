import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";
import { GIT_BASH_MISSING, shellFor } from "./play.mjs";

// architecture.md, task 37c: play:up runs play-stack.sh with Git Bash on Windows, never WSL's bash.
const GIT_ROOT = join("C:", "Program Files", "Git");
const GIT_BASH = join(GIT_ROOT, "bin", "bash.exe");
const onlyGitBash = (candidate) => candidate === GIT_BASH;

describe("shellFor", () => {
  it("uses bash from PATH outside Windows", () => {
    assert.equal(shellFor({ platform: "linux", gitPaths: [], exists: () => false }), "bash");
  });

  it("finds Git Bash from git.exe in Git's cmd folder", () => {
    assert.equal(shellFor({ platform: "win32", gitPaths: [join(GIT_ROOT, "cmd", "git.exe")], exists: onlyGitBash }), GIT_BASH);
  });

  it("finds Git Bash from git.exe in Git's mingw64 folder", () => {
    assert.equal(shellFor({ platform: "win32", gitPaths: [join(GIT_ROOT, "mingw64", "bin", "git.exe")], exists: onlyGitBash }), GIT_BASH);
  });

  it("refuses WSL's bash and explains what to install when Git Bash is missing", () => {
    assert.throws(() => shellFor({ platform: "win32", gitPaths: [], exists: () => false }), { message: GIT_BASH_MISSING });
  });
});
