import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WRITE_HEADER } from "../../../server/api-proxy";
import { DELETE, PATCH } from "./route";

vi.mock("../../../server/api-bearer", () => ({ apiBearer: async () => "api-token" }));

const api = vi.fn<typeof fetch>();

function patchRequest(body: unknown): NextRequest {
  const headers = new Headers({ [WRITE_HEADER]: "1", "content-type": "application/json" });
  return new NextRequest("http://localhost:3001/api/me", { method: "PATCH", headers, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.stubEnv("API_URL", "http://api.test:3000");
  vi.stubGlobal("fetch", api);
  api.mockResolvedValue(Response.json({ handle: "arslan" }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  api.mockReset();
});

describe("PATCH /api/me", () => {
  it("forwards a valid change to the API", async () => {
    const response = await PATCH(patchRequest({ display_name: "Arslan Berdiyev" }));

    expect(response.status).toBe(200);
    const [url, init] = api.mock.calls[0] ?? [];
    expect(url).toBe("http://api.test:3000/v1/me");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ display_name: "Arslan Berdiyev" });
  });

  it("answers an invalid body with 400 without calling the API", async () => {
    const response = await PATCH(patchRequest({ handle: "Not A Handle!" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "validation_failed" });
    expect(api).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/me", () => {
  it("forwards the deletion to the API", async () => {
    api.mockResolvedValue(Response.json({ deletion_scheduled_for: "2026-11-13T12:00:00.000Z" }, { status: 202 }));
    const headers = new Headers({ [WRITE_HEADER]: "1" });

    const response = await DELETE(new NextRequest("http://localhost:3001/api/me", { method: "DELETE", headers }));

    expect(response.status).toBe(202);
    const [url, init] = api.mock.calls[0] ?? [];
    expect(url).toBe("http://api.test:3000/v1/me");
    expect(init?.method).toBe("DELETE");
  });
});
