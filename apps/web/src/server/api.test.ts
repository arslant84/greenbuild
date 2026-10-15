import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AGE_NOT_CONFIRMED } from "@greenbuild/shared";
import { apiGet, apiGetPublic } from "./api";
import { AGE_REQUIRED_PATH } from "./sign-in-paths";

const session = { value: "dev-token" as string | undefined };
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => (session.value ? { value: session.value } : undefined) }),
}));

const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));

const api = vi.fn<typeof fetch>();
const schema = z.object({ title: z.string() });

beforeEach(() => {
  session.value = "dev-token";
  vi.stubEnv("API_URL", "http://api.test:3000");
  vi.stubGlobal("fetch", api);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  api.mockReset();
});

describe("apiGet", () => {
  it("reads as the signed-in user and validates the answer", async () => {
    api.mockResolvedValue(Response.json({ title: "The site returns 502" }));

    expect(await apiGet("/v1/challenges/x", schema)).toEqual({ title: "The site returns 502" });
    expect(new Headers(api.mock.calls[0]?.[1]?.headers).get("authorization")).toBe("Bearer dev-token");
  });

  it("sends a player who has not confirmed being 16 or older to the sign-in screen", async () => {
    api.mockResolvedValue(Response.json({ code: "forbidden", message: "x", details: { reason: AGE_NOT_CONFIRMED } }, { status: 403 }));

    await apiGet("/v1/me", schema);

    expect(redirect).toHaveBeenCalledWith(AGE_REQUIRED_PATH);
  });

  it("does not redirect for another 403", async () => {
    redirect.mockClear();
    api.mockResolvedValue(Response.json({ code: "forbidden", message: "This account is closed" }, { status: 403 }));

    expect(await apiGet("/v1/me", schema)).toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([
    ["an error status", () => api.mockResolvedValue(Response.json({}, { status: 404 }))],
    ["an unexpected answer", () => api.mockResolvedValue(Response.json({ name: 1 }))],
  ])("returns null for %s", async (_name, arrange) => {
    arrange();

    expect(await apiGet("/v1/challenges/x", schema)).toBeNull();
  });

  it("returns null without a session and does not call the API", async () => {
    session.value = undefined;

    expect(await apiGet("/v1/challenges/x", schema)).toBeNull();
    expect(api).not.toHaveBeenCalled();
  });
});

describe("apiGetPublic", () => {
  it("reads without a session or a token, also when the visitor is signed in", async () => {
    api.mockResolvedValue(Response.json({ title: "arslan" }));

    expect(await apiGetPublic("/v1/users/arslan", schema)).toEqual({ title: "arslan" });
    expect(new Headers(api.mock.calls[0]?.[1]?.headers).has("authorization")).toBe(false);
  });

  it("returns null when the API answers 404", async () => {
    api.mockResolvedValue(Response.json({}, { status: 404 }));

    expect(await apiGetPublic("/v1/users/nobody", schema)).toBeNull();
  });
});
