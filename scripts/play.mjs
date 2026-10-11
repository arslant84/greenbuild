#!/usr/bin/env node
// Runs scripts/play-stack.sh (pnpm play:up / play:down) with a POSIX shell. On Windows that must be
// Git Bash: the `bash` that WSL puts on PATH runs the script inside Linux, where the Windows
// Docker, Go and Node the stack uses are not found.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const GIT_BASH_MISSING =
  "Git Bash was not found. Install Git for Windows (https://git-scm.com/download/win) and run pnpm play:up again; WSL's bash cannot run the play stack.";

// shellFor picks the shell for play-stack.sh. Git for Windows puts git.exe in <root>\cmd or
// <root>\mingw64\bin and Git Bash in <root>\bin\bash.exe; gitPaths are where `where git` found git.
export function shellFor({ platform, gitPaths, exists }) {
  if (platform !== "win32") {
    return "bash";
  }
  for (const gitPath of gitPaths) {
    const roots = [dirname(dirname(gitPath)), dirname(dirname(dirname(gitPath)))];
    const bash = roots.map((root) => join(root, "bin", "bash.exe")).find((candidate) => exists(candidate));
    if (bash) {
      return bash;
    }
  }
  throw new Error(GIT_BASH_MISSING);
}

function gitPathsOnWindows() {
  const found = spawnSync("where", ["git"], { encoding: "utf8" });
  return found.status === 0 ? found.stdout.split(/\r?\n/).filter(Boolean) : [];
}

function main(args) {
  const platform = process.platform;
  const shell = shellFor({ platform, gitPaths: platform === "win32" ? gitPathsOnWindows() : [], exists: existsSync });
  const script = join(dirname(fileURLToPath(import.meta.url)), "play-stack.sh");
  const run = spawnSync(shell, [script, ...args], { stdio: "inherit" });
  process.exitCode = run.status ?? 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
