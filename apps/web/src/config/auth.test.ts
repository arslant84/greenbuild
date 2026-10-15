import { describe, expect, it } from "vitest";
import { loadAuthConfig } from "./auth";

const ENV = {
  AUTH_SECRET: "a".repeat(32),
  DATABASE_URL: "postgres://greenbuild:pw@127.0.0.1:5432/greenbuild",
  EMAIL_SERVER: "smtp://127.0.0.1:1025",
  EMAIL_FROM: "sign-in@greenbuild.dev",
  REDIS_URL: "redis://127.0.0.1:6379",
  API_TOKEN_PRIVATE_KEY: JSON.stringify({ kty: "EC", crv: "P-256", x: "x", y: "y", d: "d" }),
};

describe("loadAuthConfig", () => {
  it("is off without AUTH_SECRET outside production, and required in production", () => {
    expect(loadAuthConfig({})).toBeNull();
    expect(() => loadAuthConfig({ NODE_ENV: "production" })).toThrow("AUTH_SECRET: required in production");
  });

  it("offers Google only with both of its settings", () => {
    expect(loadAuthConfig(ENV)?.google).toBeNull();
    expect(loadAuthConfig({ ...ENV, AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "secret" })?.google).toEqual({ clientId: "id", clientSecret: "secret" });
    expect(() => loadAuthConfig({ ...ENV, AUTH_GOOGLE_SECRET: "secret" })).toThrow();
  });

  it("offers GitHub only with both of its settings", () => {
    expect(loadAuthConfig(ENV)?.github).toBeNull();
    expect(loadAuthConfig({ ...ENV, AUTH_GITHUB_ID: "id", AUTH_GITHUB_SECRET: "secret" })?.github).toEqual({ clientId: "id", clientSecret: "secret" });
  });

  it("turns the test sign-in on only with GREENBUILD_E2E_AUTH=1, and never in production", () => {
    expect(loadAuthConfig(ENV)?.e2eSignIn).toBe(false);
    expect(loadAuthConfig({ ...ENV, GREENBUILD_E2E_AUTH: "1" })?.e2eSignIn).toBe(true);
    expect(() => loadAuthConfig({ ...ENV, GREENBUILD_E2E_AUTH: "1", NODE_ENV: "production" })).toThrow("never runs in production");
  });

  it.each([
    { AUTH_SECRET: "short" },
    { DATABASE_URL: "mysql://db" },
    { EMAIL_SERVER: "http://mail" },
    { EMAIL_FROM: "not an email" },
    { REDIS_URL: "http://redis" },
    { AUTH_GITHUB_ID: "id" },
    { API_TOKEN_PRIVATE_KEY: JSON.stringify({ kty: "EC", crv: "P-256", x: "x", y: "y" }) },
    { API_TOKEN_PRIVATE_KEY: "not json" },
  ])("rejects %o", (override) => {
    expect(() => loadAuthConfig({ ...ENV, ...override })).toThrow();
  });
});
