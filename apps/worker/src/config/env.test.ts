import { ValidationError, WORKER_DEFAULT_PORT } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("uses defaults when variables are not set", () => {
    expect(loadEnv({})).toEqual({ NODE_ENV: "development", PORT: WORKER_DEFAULT_PORT });
  });

  it("parses PORT from a string", () => {
    expect(loadEnv({ PORT: "9090" }).PORT).toBe(9090);
  });

  it("rejects an invalid PORT with a typed error", () => {
    expect(() => loadEnv({ PORT: "not-a-port" })).toThrow(ValidationError);
  });
});
