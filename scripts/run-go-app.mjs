#!/usr/bin/env node
// Runs a Go app's binary built by `pnpm build` (`go build -o bin/`) for `pnpm dev`, instead of
// `go run`, whose child binary could outlive it on Windows (task 37d). pnpm runs scripts with cmd on
// Windows, which cannot start `bin/<name>` itself; Go adds .exe there.
//   node ../../scripts/run-go-app.mjs <name>   (from the app's folder)
import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function binaryPath({ name, platform }) {
  return join("bin", platform === "win32" ? `${name}.exe` : name);
}

function main([name]) {
  if (!name) {
    throw new Error("run-go-app: name the app, e.g. sandbox-agent");
  }
  const child = spawn(binaryPath({ name, platform: process.platform }), { stdio: "inherit" });
  // Ctrl+C reaches the app itself (same console or process group); stay alive until it has shut down.
  process.on("SIGINT", () => undefined);
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  child.on("error", (error) => {
    console.error(`run-go-app: cannot start ${name} (run pnpm build first): ${error.message}`);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
