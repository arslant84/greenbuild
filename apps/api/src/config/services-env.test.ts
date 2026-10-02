import { ValidationError } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { loadServicesEnv } from "./services-env.js";

const valid = {
  DATABASE_URL: "postgres://api:db-password@db:5432/greenbuild",
  REDIS_URL: "redis://:redis-password@redis:6379",
  ATTACH_SECRET: "a".repeat(32),
  DEV_AUTH_SECRET: "d".repeat(32),
};

describe("loadServicesEnv", () => {
  it("accepts complete settings", () => {
    expect(loadServicesEnv(valid)).toEqual({ NODE_ENV: "development", ...valid });
  });

  it("treats an empty dev auth secret as unset", () => {
    expect(loadServicesEnv({ ...valid, DEV_AUTH_SECRET: "" }).DEV_AUTH_SECRET).toBeUndefined();
  });

  it("names the wrong variables without their values", () => {
    const bad = { ...valid, DATABASE_URL: "mysql://api:db-password@db/greenbuild", ATTACH_SECRET: "short-secret" };
    let error: unknown;
    try {
      loadServicesEnv(bad);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details).toEqual({ variables: ["DATABASE_URL", "ATTACH_SECRET"] });
    expect(JSON.stringify((error as ValidationError).toResponse())).not.toMatch(/db-password|short-secret/);
  });

  it.each(["DATABASE_URL", "REDIS_URL", "ATTACH_SECRET"])("requires %s", (name) => {
    expect(() => loadServicesEnv({ ...valid, [name]: undefined })).toThrow(ValidationError);
  });
});
