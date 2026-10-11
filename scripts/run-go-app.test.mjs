import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";
import { binaryPath } from "./run-go-app.mjs";

// architecture.md, task 37d: pnpm dev runs the binary `go build -o bin/` produced, not `go run`.
describe("binaryPath", () => {
  it("adds .exe on Windows, as go build does", () => {
    assert.equal(binaryPath({ name: "sandbox-agent", platform: "win32" }), join("bin", "sandbox-agent.exe"));
  });

  it("uses the bare name elsewhere", () => {
    assert.equal(binaryPath({ name: "sandbox-agent", platform: "linux" }), join("bin", "sandbox-agent"));
  });
});
