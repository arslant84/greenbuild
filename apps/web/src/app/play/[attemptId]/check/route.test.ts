import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const TICKET_SECRET = "ticket-secret-ticket-secret-ticket";
const INTERNAL_TOKEN = "internal-token-internal-token-123";

function ticketFor(attemptId: string): string {
  const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString("base64url");
  const claims = { aud: "dev-check", exp: Date.now() / 1000 + 60, attempt_id: attemptId, sandbox_id: "sbx-1", challenge_id: "nginx-502-upstream" };
  const signed = `${encode({ alg: "HS256" })}.${encode(claims)}`;
  return `${signed}.${createHmac("sha256", TICKET_SECRET).update(signed).digest("base64url")}`;
}

function check(attemptId: string, ticket?: string): Promise<Response> {
  const init: RequestInit = ticket ? { method: "POST", headers: { authorization: `Bearer ${ticket}` } } : { method: "POST" };
  return POST(new Request(`http://localhost/play/${attemptId}/check`, init), {
    params: Promise.resolve({ attemptId }),
  });
}

// fakeEngine sets up a dev environment and returns the stand-in for the engine's HTTP API.
function fakeEngine() {
  const engine = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("GREENBUILD_DEV_CHECK_SECRET", TICKET_SECRET);
    vi.stubEnv("ENGINE_INTERNAL_TOKEN", INTERNAL_TOKEN);
    vi.stubEnv("ENGINE_INTERNAL_URL", "http://engine.test:8080");
    vi.stubGlobal("fetch", engine);
    engine.mockResolvedValue(Response.json({ passed: true, output_tail: "the site is back", duration_ms: 812 }));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    engine.mockReset();
  });
  return engine;
}

describe("POST /play/{attemptId}/check", () => {
  const engine = fakeEngine();

  it("checks the ticket's sandbox through the engine with the internal token", async () => {
    const response = await check("dev-1", ticketFor("dev-1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ passed: true, output_tail: "the site is back", duration_ms: 812 });
    const [url, init] = engine.mock.calls[0] ?? [];
    expect(url).toBe("http://engine.test:8080/internal/attempts/dev-1/check");
    expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${INTERNAL_TOKEN}`);
    expect(JSON.parse(String(init?.body))).toEqual({ sandbox_id: "sbx-1", challenge_id: "nginx-502-upstream" });
  });

  it.each([
    ["no ticket", undefined],
    ["another attempt's ticket", ticketFor("dev-2")],
  ])("refuses %s without calling the engine", async (_name, ticket) => {
    const response = await check("dev-1", ticket);

    expect(response.status).toBe(401);
    expect((await response.json()) as unknown).toMatchObject({ code: "unauthorized" });
    expect(engine).not.toHaveBeenCalled();
  });
});

describe("POST /play/{attemptId}/check when it cannot run", () => {
  const engine = fakeEngine();

  it("is off in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    expect((await check("dev-1", ticketFor("dev-1"))).status).toBe(404);
    expect(engine).not.toHaveBeenCalled();
  });

  it("reports an engine failure without its details", async () => {
    engine.mockResolvedValue(new Response("boom", { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await check("dev-1", ticketFor("dev-1"));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ code: "internal", message: "The check could not run" });
  });
});
