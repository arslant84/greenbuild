import { jwtVerify } from "jose";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";
import { DEV_SESSION_COOKIE } from "./server/dev-session";

const SECRET = "dev-auth-secret-dev-auth-secret-32";

function visit(cookie?: string): Promise<Response> {
  const headers = cookie ? { cookie: `${DEV_SESSION_COOKIE}=${cookie}` } : undefined;
  return proxy(new NextRequest("http://localhost:3001/play", headers ? { headers } : {}));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy", () => {
  it("starts an httpOnly dev session on the first visit", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_SECRET", SECRET);
    const cookie = (await visit()).headers.get("set-cookie") ?? "";

    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    const token = new RegExp(`${DEV_SESSION_COOKIE}=([^;]+)`).exec(cookie)?.[1] ?? "";
    const { payload } = await jwtVerify(token, new TextEncoder().encode(SECRET), { audience: "greenbuild-dev-user" });
    expect(payload.sub).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps an existing session", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_SECRET", SECRET);

    expect((await visit("existing")).headers.get("set-cookie")).toBeNull();
  });

  it.each([
    ["in production", { NODE_ENV: "production", DEV_AUTH_SECRET: SECRET }],
    ["without DEV_AUTH_SECRET", { NODE_ENV: "development" }],
  ])("starts no session %s", async (_name, env) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);

    expect((await visit()).headers.get("set-cookie")).toBeNull();
  });
});
