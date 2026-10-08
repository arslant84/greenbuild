import { afterEach, describe, expect, it, vi } from "vitest";
import { JsonLogger } from "./json-logger.js";

describe("JsonLogger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("writes Nest's errors as redacted JSON with their context", () => {
    const written: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((line) => written.push(String(line)) > 0);
    new JsonLogger().error(new Error("connect postgres://app:p4ss@db/app failed"), "DatabaseClient");
    const entry = JSON.parse(written[0] ?? "{}") as Record<string, unknown>;
    expect(entry).toMatchObject({ level: "error", service: "api", context: "DatabaseClient", msg: "connect postgres://app:[REDACTED]@db/app failed" });
    expect(written[0]).not.toContain("p4ss");
  });
});
