import { describe, expect, it } from "vitest";
import { loadAuthConfig } from "./auth";

const ENV = {
  AUTH_SECRET: "a".repeat(32),
  DATABASE_URL: "postgres://greenbuild:pw@127.0.0.1:5432/greenbuild",
  EMAIL_SERVER: "smtp://127.0.0.1:1025",
  EMAIL_FROM: "sign-in@greenbuild.dev",
  API_TOKEN_PRIVATE_KEY: JSON.stringify({ kty: "EC", crv: "P-256", x: "x", y: "y", d: "d" }),
};

describe("loadAuthConfig", () => {
  it("is off without AUTH_SECRET outside production, and required in production", () => {
    expect(loadAuthConfig({})).toBeNull();
    expect(() => loadAuthConfig({ NODE_ENV: "production" })).toThrow("AUTH_SECRET: required in production");
  });

  it("offers GitHub only with both of its settings", () => {
    expect(loadAuthConfig(ENV)?.github).toBeNull();
    expect(loadAuthConfig({ ...ENV, AUTH_GITHUB_ID: "id", AUTH_GITHUB_SECRET: "secret" })?.github).toEqual({ clientId: "id", clientSecret: "secret" });
  });

  it.each([
    { AUTH_SECRET: "short" },
    { DATABASE_URL: "mysql://db" },
    { EMAIL_SERVER: "http://mail" },
    { EMAIL_FROM: "not an email" },
    { AUTH_GITHUB_ID: "id" },
    { API_TOKEN_PRIVATE_KEY: JSON.stringify({ kty: "EC", crv: "P-256", x: "x", y: "y" }) },
    { API_TOKEN_PRIVATE_KEY: "not json" },
  ])("rejects %o", (override) => {
    expect(() => loadAuthConfig({ ...ENV, ...override })).toThrow();
  });
});
