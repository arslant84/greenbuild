import { describe, expect, it } from "vitest";
import { loadDevCheckConfig } from "./dev-check";

const SECRET = "s".repeat(32);
const TOKEN = "t".repeat(32);

describe("loadDevCheckConfig", () => {
  it("is on in development with both secrets", () => {
    expect(loadDevCheckConfig({ GREENBUILD_DEV_CHECK_SECRET: SECRET, ENGINE_INTERNAL_TOKEN: TOKEN })).toEqual({
      ticketSecret: SECRET,
      internalToken: TOKEN,
      internalUrl: "http://127.0.0.1:8080",
    });
  });

  it.each([
    ["production", { NODE_ENV: "production", GREENBUILD_DEV_CHECK_SECRET: SECRET, ENGINE_INTERNAL_TOKEN: TOKEN }],
    ["no ticket secret", { ENGINE_INTERNAL_TOKEN: TOKEN }],
    ["no internal token", { GREENBUILD_DEV_CHECK_SECRET: SECRET }],
  ])("is off in %s", (_name, env) => {
    expect(loadDevCheckConfig(env)).toBeNull();
  });

  it("rejects a short secret without echoing it", () => {
    const short = "hunter2";
    let message = "";
    try {
      loadDevCheckConfig({ GREENBUILD_DEV_CHECK_SECRET: short, ENGINE_INTERNAL_TOKEN: TOKEN });
    } catch (error) {
      message = String(error);
    }
    expect(message).not.toBe("");
    expect(message).not.toContain(short);
  });
});
