import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxyToApi, WRITE_HEADER } from "./api-proxy";
import { DEV_SESSION_COOKIE } from "./dev-session";

const api = vi.fn<typeof fetch>();

function pageRequest(options: { session?: string; write?: boolean }): NextRequest {
  const headers = new Headers();
  if (options.session) headers.set("cookie", `${DEV_SESSION_COOKIE}=${options.session}`);
  if (options.write) headers.set(WRITE_HEADER, "1");
  return new NextRequest("http://localhost:3001/api/attempts", { method: "POST", headers });
}

beforeEach(() => {
  vi.stubEnv("API_URL", "http://api.test:3000");
  vi.stubGlobal("fetch", api);
  api.mockResolvedValue(Response.json({ id: "a1", status: "starting" }, { status: 201 }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  api.mockReset();
});

describe("proxyToApi", () => {
  it("forwards to the API as the signed-in user and passes the answer back", async () => {
    const response = await proxyToApi(pageRequest({ session: "dev-token", write: true }), { method: "POST", path: "/v1/attempts", body: { challenge_slug: "x" } });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "a1", status: "starting" });
    const [url, init] = api.mock.calls[0] ?? [];
    expect(url).toBe("http://api.test:3000/v1/attempts");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer dev-token");
    expect(JSON.parse(String(init?.body))).toEqual({ challenge_slug: "x" });
  });

  it.each([
    { name: "a write without the request header", request: { session: "dev-token" }, status: 403, code: "forbidden" },
    { name: "no session", request: { write: true }, status: 401, code: "unauthorized" },
  ])("refuses $name without calling the API", async ({ request, status, code }) => {
    const response = await proxyToApi(pageRequest(request), { method: "POST", path: "/v1/attempts" });

    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ code });
    expect(api).not.toHaveBeenCalled();
  });

  it("answers 503 when the API cannot be reached", async () => {
    api.mockRejectedValue(new TypeError("fetch failed"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await proxyToApi(pageRequest({ session: "dev-token" }), { method: "GET", path: "/v1/attempts/a1" });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "unavailable" });
  });
});
