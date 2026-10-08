import { describe, expect, it } from "vitest";
import { createLogger, REDACTED, redact } from "./index.js";

describe("redact", () => {
  it("masks credential headers and secret fields in a logged request", () => {
    const request = {
      method: "POST",
      path: "/v1/attempts",
      headers: { Authorization: "Bearer eyJhbGciOi.secret", Cookie: "gb_session=abc", "content-type": "application/json" },
      body: { challenge_slug: "nginx-502-upstream", password: "hunter2", refresh_token: "r-123", nested: { clientSecret: "s" } },
    };
    expect(redact(request)).toEqual({
      method: "POST",
      path: "/v1/attempts",
      headers: { Authorization: REDACTED, Cookie: REDACTED, "content-type": "application/json" },
      body: { challenge_slug: "nginx-502-upstream", password: REDACTED, refresh_token: REDACTED, nested: { clientSecret: REDACTED } },
    });
  });

  it("masks the password in connection strings, also inside messages and errors", () => {
    expect(redact("connect postgres://app:p4ss@db:5432/app failed")).toBe(`connect postgres://app:${REDACTED}@db:5432/app failed`);
    expect(redact({ url: "redis://:p4ss@cache:6379" })).toEqual({ url: `redis://:${REDACTED}@cache:6379` });
    const error = redact(new Error("cannot reach postgres://app:p4ss@db/app")) as { message: string; stack: string };
    expect(error.message).not.toContain("p4ss");
    expect(error.stack).not.toContain("p4ss");
  });

  it("leaves values without credentials as they are", () => {
    expect(redact({ attempt: "a1", checks: [1, 2], at: "http://example.com/x", ok: true })).toEqual({ attempt: "a1", checks: [1, 2], at: "http://example.com/x", ok: true });
  });
});

describe("createLogger", () => {
  it("writes one JSON line with the level, service and redacted fields", () => {
    const lines: string[] = [];
    createLogger("api", (_level, line) => lines.push(line)).warn("redis: connect redis://:p4ss@cache failed", { token: "t" });
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(entry).toMatchObject({ level: "warn", service: "api", msg: `redis: connect redis://:${REDACTED}@cache failed`, token: REDACTED });
    expect(lines[0]).not.toContain("p4ss");
  });
});
