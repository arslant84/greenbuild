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

  it("reads the database and Redis URLs for the outbox relay", () => {
    const env = loadEnv({ DATABASE_URL: "postgres://worker:secret@db:5432/greenbuild", REDIS_URL: "redis://cache:6379" });
    expect(env).toMatchObject({ DATABASE_URL: "postgres://worker:secret@db:5432/greenbuild", REDIS_URL: "redis://cache:6379" });
  });

  it("treats empty URLs as unset", () => {
    expect(loadEnv({ DATABASE_URL: "", REDIS_URL: "" })).toEqual({ NODE_ENV: "development", PORT: WORKER_DEFAULT_PORT });
  });

  it("refuses one URL without the other, without echoing it", () => {
    let message = "";
    try {
      loadEnv({ DATABASE_URL: "postgres://worker:secret@db:5432/greenbuild" });
    } catch (error) {
      message = JSON.stringify(error);
    }
    expect(message).toContain("REDIS_URL");
    expect(message).not.toContain("secret");
  });
});
