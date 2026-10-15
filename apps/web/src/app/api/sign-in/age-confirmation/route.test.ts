import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { WRITE_HEADER } from "../../../../server/api-proxy";
import { AGE_COOKIE } from "../../../../server/age-cookie";
import { POST } from "./route";

function confirmation(body: unknown, headers: Record<string, string> = { [WRITE_HEADER]: "1" }): NextRequest {
  return new NextRequest("http://localhost:3001/api/sign-in/age-confirmation", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sign-in/age-confirmation", () => {
  it("remembers the confirmation in an HttpOnly, same-site cookie", async () => {
    const response = await POST(confirmation({ confirmed: true }));

    expect(response.status).toBe(204);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${AGE_COOKIE}=1`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
  });

  it("refuses a request without the write header, and anything but a confirmation", async () => {
    expect((await POST(confirmation({ confirmed: true }, {}))).status).toBe(403);
    expect((await POST(confirmation({ confirmed: false }))).status).toBe(400);
  });
});
