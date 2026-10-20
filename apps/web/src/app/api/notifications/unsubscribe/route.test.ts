import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const api = vi.fn<typeof fetch>();
const TOKEN = "0199a5c4-7b2e-7c3a-9f10-2b3c4d5e6f70";

function oneClick(token: string): NextRequest {
  return new NextRequest(`http://localhost:3001/api/notifications/unsubscribe?token=${token}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "List-Unsubscribe=One-Click",
  });
}

beforeEach(() => {
  vi.stubEnv("API_URL", "http://api.test:3000");
  vi.stubGlobal("fetch", api);
  api.mockResolvedValue(new Response(null, { status: 204 }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  api.mockReset();
});

describe("POST /api/notifications/unsubscribe", () => {
  it("passes a mail provider's one-click request on to the API, without a session", async () => {
    const response = await POST(oneClick(TOKEN));

    expect(response.status).toBe(204);
    const [url, init] = api.mock.calls[0] ?? [];
    expect(url).toBe("http://api.test:3000/v1/notifications/unsubscribe");
    expect(new Headers(init?.headers).get("authorization")).toBeNull();
    expect(JSON.parse(String(init?.body))).toEqual({ token: TOKEN });
  });

  it("answers a link without a valid token with 400, without calling the API", async () => {
    expect((await POST(oneClick("everyone"))).status).toBe(400);
    expect(api).not.toHaveBeenCalled();
  });
});
