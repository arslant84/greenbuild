import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WRITE_HEADER } from "../../../../server/api-proxy";
import { PUT } from "./route";

vi.mock("../../../../server/api-bearer", () => ({ apiBearer: async () => "api-token" }));

const api = vi.fn<typeof fetch>();

function putRequest(body: unknown): NextRequest {
  const headers = new Headers({ [WRITE_HEADER]: "1", "content-type": "application/json" });
  return new NextRequest("http://localhost:3001/api/me/notifications", { method: "PUT", headers, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.stubEnv("API_URL", "http://api.test:3000");
  vi.stubGlobal("fetch", api);
  api.mockResolvedValue(Response.json({ streak_reminder_email: true, reminder_hour: 7 }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  api.mockReset();
});

describe("PUT /api/me/notifications", () => {
  it("forwards a valid change to the API", async () => {
    const response = await PUT(putRequest({ streak_reminder_email: true, reminder_hour: 7 }));

    expect(response.status).toBe(200);
    const [url, init] = api.mock.calls[0] ?? [];
    expect(url).toBe("http://api.test:3000/v1/me/notifications");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({ streak_reminder_email: true, reminder_hour: 7 });
  });

  it("answers an invalid body with 400 without calling the API", async () => {
    const response = await PUT(putRequest({ streak_reminder_email: true, reminder_hour: 24 }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "validation_failed" });
    expect(api).not.toHaveBeenCalled();
  });
});
