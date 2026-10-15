import type { AgeStatus } from "@greenbuild/db/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  ageStatus: vi.fn(),
  hasAgeConfirmation: vi.fn(),
  recordAgeConfirmation: vi.fn(),
  confirmUser: vi.fn(),
}));
const browser = vi.hoisted(() => ({ confirmed: false }));
vi.mock("@greenbuild/db/auth", () => db);
vi.mock("./age-confirmation", () => ({ ageConfirmedInBrowser: async () => browser.confirmed }));

const { AGE_REQUIRED_PATH, ageCheck, ageDecision } = await import("./sign-in-age");

const NEW: AgeStatus = { kind: "new" };
const OLDER: AgeStatus = { kind: "unconfirmed", userId: "older-player" };
const CONFIRMED: AgeStatus = { kind: "confirmed", userId: "player" };
const EMAIL_ACCOUNT = { type: "email", provider: "email", providerAccountId: "ada@example.com" } as const;
const GITHUB_ACCOUNT = { type: "oauth", provider: "github", providerAccountId: "4242" } as const;

describe("ageDecision", () => {
  it.each([
    { name: "a confirmed player", status: CONFIRMED, step: "request-link", inBrowser: false, recorded: false, expected: "allow" },
    { name: "a new player asking for a link with the box", status: NEW, step: "request-link", inBrowser: true, recorded: false, expected: "record" },
    { name: "a new player asking for a link without it", status: NEW, step: "request-link", inBrowser: false, recorded: false, expected: "deny" },
    { name: "a new player opening the link in another browser", status: NEW, step: "complete", inBrowser: false, recorded: true, expected: "allow" },
    { name: "a new player through GitHub with the box", status: NEW, step: "complete", inBrowser: true, recorded: false, expected: "allow" },
    { name: "a new player through GitHub without it", status: NEW, step: "complete", inBrowser: false, recorded: false, expected: "deny" },
    { name: "an older player with the box", status: OLDER, step: "complete", inBrowser: true, recorded: false, expected: "confirm" },
    { name: "an older player without it", status: OLDER, step: "complete", inBrowser: false, recorded: false, expected: "deny" },
  ] as const)("$name: $expected", ({ status, step, inBrowser, recorded, expected }) => {
    expect(ageDecision(status, step, { inBrowser, recorded })).toBe(expected);
  });
});

describe("ageCheck", () => {
  const signIn = ageCheck({} as never);

  beforeEach(() => {
    vi.clearAllMocks();
    browser.confirmed = false;
    db.hasAgeConfirmation.mockResolvedValue(false);
  });

  it("records the confirmation for the address when a new player asks for a link with the box", async () => {
    db.ageStatus.mockResolvedValue(NEW);
    browser.confirmed = true;

    expect(await signIn({ user: { id: "x" }, account: EMAIL_ACCOUNT, email: { verificationRequest: true } })).toBe(true);
    expect(db.recordAgeConfirmation).toHaveBeenCalledWith({}, "ada@example.com", expect.any(Date));
  });

  it("sends a new player without the box back to the sign-in screen, and records nothing", async () => {
    db.ageStatus.mockResolvedValue(NEW);

    expect(await signIn({ user: { id: "x" }, account: GITHUB_ACCOUNT })).toBe(AGE_REQUIRED_PATH);
    expect(db.ageStatus).toHaveBeenCalledWith({}, { provider: "github", providerUserId: "4242" });
    expect(db.recordAgeConfirmation).not.toHaveBeenCalled();
  });

  it("lets a link opened in another browser through on the recorded confirmation", async () => {
    db.ageStatus.mockResolvedValue(NEW);
    db.hasAgeConfirmation.mockResolvedValue(true);

    expect(await signIn({ user: { id: "x" }, account: EMAIL_ACCOUNT })).toBe(true);
  });

  it("completes an older player who ticks the box", async () => {
    db.ageStatus.mockResolvedValue(OLDER);
    browser.confirmed = true;

    expect(await signIn({ user: { id: "older-player" }, account: GITHUB_ACCOUNT })).toBe(true);
    expect(db.confirmUser).toHaveBeenCalledWith({}, "older-player");
  });

  it("leaves the e2e sign-in to confirm its test players itself", async () => {
    expect(await signIn({ user: { id: "x" }, account: { type: "credentials", provider: "e2e", providerAccountId: "x" } })).toBe(true);
    expect(db.ageStatus).not.toHaveBeenCalled();
  });
});
