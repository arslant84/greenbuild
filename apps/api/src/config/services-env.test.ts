import { ValidationError } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { loadServicesEnv } from "./services-env.js";

const valid = {
  DATABASE_URL: "postgres://api:db-password@db:5432/greenbuild",
  REDIS_URL: "redis://:redis-password@redis:6379",
  ATTACH_SECRET: "a".repeat(32),
  ENGINE_INTERNAL_URL: "http://engine:8080",
  ENGINE_INTERNAL_TOKEN: "i".repeat(32),
};

describe("loadServicesEnv", () => {
  it("accepts complete settings", () => {
    expect(loadServicesEnv(valid)).toEqual({ NODE_ENV: "development", ...valid });
  });

  it("treats an empty API token key as unset", () => {
    expect(loadServicesEnv({ ...valid, API_TOKEN_PUBLIC_KEY: "" }).API_TOKEN_PUBLIC_KEY).toBeUndefined();
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

  it("accepts the web app's public key and requires it in production", () => {
    const publicJwk = JSON.stringify({ kty: "EC", crv: "P-256", x: "x-coordinate", y: "y-coordinate" });

    expect(loadServicesEnv({ ...valid, API_TOKEN_PUBLIC_KEY: publicJwk }).API_TOKEN_PUBLIC_KEY).toBe(publicJwk);
    expect(() => loadServicesEnv({ ...valid, NODE_ENV: "production" })).toThrow(ValidationError);
  });

  it.each([
    ["a private key", JSON.stringify({ kty: "EC", crv: "P-256", x: "x", y: "y", d: "private" })],
    ["another curve", JSON.stringify({ kty: "EC", crv: "P-384", x: "x", y: "y" })],
    ["no JSON", "-----BEGIN PUBLIC KEY-----"],
  ])("refuses %s as the API token key", (_case, key) => {
    expect(() => loadServicesEnv({ ...valid, API_TOKEN_PUBLIC_KEY: key })).toThrow(ValidationError);
  });

  it.each(["DATABASE_URL", "REDIS_URL", "ATTACH_SECRET", "ENGINE_INTERNAL_URL", "ENGINE_INTERNAL_TOKEN"])("requires %s", (name) => {
    expect(() => loadServicesEnv({ ...valid, [name]: undefined })).toThrow(ValidationError);
  });
});
