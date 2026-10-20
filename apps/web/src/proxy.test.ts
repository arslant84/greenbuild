import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Auth.js as the proxy sees it: configured or not, and the visitor's session.
const signIn = vi.hoisted(() => ({ configured: true, userId: null as string | null }));
vi.mock("./server/auth", () => ({
  authInstance: () => (signIn.configured ? { auth: async () => (signIn.userId ? { user: { id: signIn.userId } } : null) } : null),
}));

const { proxy } = await import("./proxy");

function visit(path: string): Promise<Response> {
  return proxy(new NextRequest(`http://localhost:3001${path}`));
}

beforeEach(() => {
  signIn.configured = true;
  signIn.userId = null;
});

describe("proxy", () => {
  it("sends a visitor without a session to sign in, and back to the page after", async () => {
    const response = await visit("/challenges?skill=nginx");

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/signin");
    expect(location.searchParams.get("callbackUrl")).toBe("/challenges?skill=nginx");
  });

  it("lets a signed-in player through", async () => {
    signIn.userId = "player";

    expect((await visit("/play")).headers.get("location")).toBeNull();
  });

  it("redirects nobody when sign-in is not configured", async () => {
    signIn.configured = false;

    expect((await visit("/play")).headers.get("location")).toBeNull();
  });
});
