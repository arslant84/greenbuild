import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ forwardedFor: null as string | null }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(request.forwardedFor ? { "x-forwarded-for": request.forwardedFor } : {}) }));

const { LINK_REQUESTS_PER_WINDOW, LINK_WINDOW_SEC } = await import("./link-limit");
const { linkLimit, linkRequestWait } = await import("./sign-in-limit");
const { rateLimitedPath } = await import("./sign-in-paths");

// The window as Redis would keep it, frozen: a key's time left is the whole window.
function memoryCounter() {
  const counts = new Map<string, number>();
  return {
    incr: async (key: string) => {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts.get(key) ?? 0;
    },
    expire: async () => 1,
    ttl: async () => LINK_WINDOW_SEC,
  };
}

async function requests(counter: ReturnType<typeof memoryCounter>, times: number, who: { email: string; ip: string }): Promise<number[]> {
  const waits: number[] = [];
  for (let n = 0; n < times; n += 1) {
    waits.push(await linkRequestWait(counter, who));
  }
  return waits;
}

describe("linkRequestWait", () => {
  it("lets five requests for an address through and makes the sixth wait out the window", async () => {
    const waits = await requests(memoryCounter(), LINK_REQUESTS_PER_WINDOW + 1, { email: "ada@example.com", ip: "203.0.113.7" });

    expect(waits).toEqual([0, 0, 0, 0, 0, LINK_WINDOW_SEC]);
  });

  it("counts an address in any case, from any IP", async () => {
    const counter = memoryCounter();
    await requests(counter, LINK_REQUESTS_PER_WINDOW, { email: "ada@example.com", ip: "203.0.113.7" });

    expect(await linkRequestWait(counter, { email: "ADA@example.com", ip: "198.51.100.1" })).toBe(LINK_WINDOW_SEC);
  });

  it("counts an IP across addresses", async () => {
    const counter = memoryCounter();
    for (let n = 0; n < LINK_REQUESTS_PER_WINDOW; n += 1) {
      await linkRequestWait(counter, { email: `player-${n}@example.com`, ip: "203.0.113.7" });
    }

    expect(await linkRequestWait(counter, { email: "new@example.com", ip: "203.0.113.7" })).toBe(LINK_WINDOW_SEC);
  });
});

describe("linkLimit", () => {
  beforeEach(() => {
    request.forwardedFor = null;
  });

  it("sends a request past the limit to the screen's rate-limited state", async () => {
    const counter = memoryCounter();
    const limit = linkLimit(async () => counter);
    for (let n = 0; n < LINK_REQUESTS_PER_WINDOW; n += 1) {
      expect(await limit({ email: "ada@example.com", verificationRequest: true })).toBeNull();
    }

    expect(await limit({ email: "ada@example.com", verificationRequest: true })).toBe(rateLimitedPath(LINK_WINDOW_SEC));
  });

  it("counts the IP the ingress appended, not one the client sent", async () => {
    const counter = memoryCounter();
    const limit = linkLimit(async () => counter);
    request.forwardedFor = "10.0.0.1, 203.0.113.7";
    for (let n = 0; n < LINK_REQUESTS_PER_WINDOW; n += 1) {
      await limit({ email: `player-${n}@example.com`, verificationRequest: true });
    }
    request.forwardedFor = "10.9.9.9, 203.0.113.7";

    expect(await limit({ email: "new@example.com", verificationRequest: true })).toBe(rateLimitedPath(LINK_WINDOW_SEC));
  });

  it("leaves completing a sign-in alone", async () => {
    const counter = memoryCounter();
    const limit = linkLimit(async () => counter);

    expect(await limit({ email: "ada@example.com", verificationRequest: false })).toBeNull();
  });
});
