import { afterEach, describe, expect, it, vi } from "vitest";

const log = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("./logger", () => ({ logger: log }));
vi.mock("../config/auth", () => ({ loadAuthConfig: () => null }));
// Sign-in itself is never built here; these stand in for the heavy modules it would use.
vi.mock("next-auth", () => ({ default: vi.fn() }));
vi.mock("next-auth/providers/github", () => ({ default: vi.fn() }));
vi.mock("next-auth/providers/google", () => ({ default: vi.fn() }));
vi.mock("@greenbuild/db/auth", () => ({ authAdapter: vi.fn(), connect: vi.fn() }));
vi.mock("./age-confirmation", () => ({ ageConfirmedInBrowser: vi.fn() }));
vi.mock("./e2e-sign-in", () => ({ e2eSignIn: vi.fn() }));
vi.mock("./email-sign-in", () => ({ emailSignIn: vi.fn() }));
vi.mock("./sign-in-age", () => ({ ageCheck: vi.fn() }));
vi.mock("./sign-in-limit", () => ({ linkLimit: vi.fn(), redisCounter: vi.fn() }));

describe("authInstance", () => {
  afterEach(() => {
    vi.resetModules();
    log.error.mockReset();
  });

  it("says once in the log that sign-in is off without its settings", async () => {
    const { authInstance, SIGN_IN_OFF } = await import("./auth");

    expect(authInstance()).toBeNull();
    expect(authInstance()).toBeNull();
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith(SIGN_IN_OFF);
  });
});
