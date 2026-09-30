import { API_DEFAULT_PORT, ValidationError } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("uses defaults when variables are not set", () => {
    expect(loadEnv({})).toEqual({ NODE_ENV: "development", PORT: API_DEFAULT_PORT });
  });

  it("parses PORT from a string", () => {
    expect(loadEnv({ PORT: "8080" }).PORT).toBe(8080);
  });

  it("rejects an invalid PORT with a typed error", () => {
    expect(() => loadEnv({ PORT: "not-a-port" })).toThrow(ValidationError);
  });

  it("rejects an unknown NODE_ENV", () => {
    expect(() => loadEnv({ NODE_ENV: "staging-ish" })).toThrow(ValidationError);
  });
});
