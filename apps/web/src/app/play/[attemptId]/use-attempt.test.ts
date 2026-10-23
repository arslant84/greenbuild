import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAttempt, isFinished } from "./use-attempt";

const ID = "0199a5c4-7b2e-7c3a-9f10-2b3c4d5e6f70";
const api = vi.fn<typeof fetch>();
const attempt = { id: ID, status: "ready", challenge_slug: "nginx-502-upstream", created_at: "2026-10-02T10:00:00.000Z", started_at: "2026-10-02T10:00:12.000Z", checks_used: 0, hints: [], hints_total: 3, attach_token: "t" };

beforeEach(() => vi.stubGlobal("fetch", api));
afterEach(() => {
  vi.unstubAllGlobals();
  api.mockReset();
});

describe("fetchAttempt", () => {
  it("reads the attempt through the web app's proxy", async () => {
    api.mockResolvedValue(Response.json(attempt));

    expect(await fetchAttempt(ID)).toEqual(attempt);
    expect(api.mock.calls[0]?.[0]).toBe(`/api/attempts/${ID}`);
  });

  it.each([
    ["an error status", () => api.mockResolvedValue(Response.json({ code: "not_found" }, { status: 404 }))],
    ["an unexpected answer", () => api.mockResolvedValue(Response.json({ id: 1 }))],
    ["no network", () => api.mockRejectedValue(new TypeError("fetch failed"))],
  ])("returns null for %s", async (_name, arrange) => {
    arrange();

    expect(await fetchAttempt(ID)).toBeNull();
  });
});

describe("isFinished", () => {
  it.each([
    ["starting", false],
    ["ready", false],
    ["solved", true],
    ["failed", true],
    ["expired", true],
    ["abandoned", true],
  ] as const)("%s → %s", (status, finished) => {
    expect(isFinished(status)).toBe(finished);
  });
});
