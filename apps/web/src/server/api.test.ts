import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiGet } from "./api";

const session = { value: "dev-token" as string | undefined };
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => (session.value ? { value: session.value } : undefined) }),
}));

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
