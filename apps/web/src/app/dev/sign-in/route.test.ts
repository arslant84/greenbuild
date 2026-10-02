import { jwtVerify } from "jose";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEV_SESSION_COOKIE } from "../../../server/dev-session";
import { POST } from "./route";

const SECRET = "dev-auth-secret-dev-auth-secret-32";

function signIn(): Promise<Response> {
  return POST(new NextRequest("http://localhost:3001/dev/sign-in", { method: "POST" }));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /dev/sign-in", () => {
  it("starts an httpOnly session as a new dev user and returns to the daily challenge", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_SECRET", SECRET);
    const response = await signIn();

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3001/play");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    const token = new RegExp(`${DEV_SESSION_COOKIE}=([^;]+)`).exec(cookie)?.[1] ?? "";
    const { payload } = await jwtVerify(token, new TextEncoder().encode(SECRET), { audience: "greenbuild-dev-user" });
    expect(payload.sub).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each([
    ["in production", { NODE_ENV: "production", DEV_AUTH_SECRET: SECRET }],
    ["without DEV_AUTH_SECRET", { NODE_ENV: "development" }],
  ])("does not exist %s", async (_name, env) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);

    expect((await signIn()).status).toBe(404);
  });
});
