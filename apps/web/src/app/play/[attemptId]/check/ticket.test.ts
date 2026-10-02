import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyTicket } from "./ticket";

// Signed by cmd/dev-attempt's signTicket (Go) at 2026-10-02T00:00:00Z, valid for 2 hours.
const GO_SIGNED_TICKET =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdHRlbXB0X2lkIjoiZGV2LWZpeHR1cmUiLCJzYW5kYm94X2lkIjoic2J4LWZpeHR1cmUiLCJjaGFsbGVuZ2VfaWQiOiJuZ2lueC01MDItdXBzdHJlYW0iLCJzdWIiOiJkZXYtdXNlciIsImF1ZCI6WyJkZXYtY2hlY2siXSwiZXhwIjoxNzkwOTA2NDAwLCJpYXQiOjE3OTA4OTkyMDB9.7oFtaylnOTSaRMFFz_f6vUJBUAZjciFgofuZnHpnh-A";
const FIXTURE_SECRET = "fixture-secret-fixture-secret-32b";
const SIGNED_AT_MS = Date.UTC(2026, 9, 2);
const HOUR_MS = 3_600_000;

function sign(header: object, claims: object, secret = FIXTURE_SECRET): string {
  const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString("base64url");
  const signed = `${encode(header)}.${encode(claims)}`;
  return `${signed}.${createHmac("sha256", secret).update(signed).digest("base64url")}`;
}

const validClaims = {
  aud: "dev-check",
  exp: SIGNED_AT_MS / 1000 + 60,
  attempt_id: "dev-1",
  sandbox_id: "sbx-1",
  challenge_id: "nginx-502-upstream",
};

describe("verifyTicket", () => {
  it("accepts a ticket signed by the Go dev script", () => {
    expect(verifyTicket(GO_SIGNED_TICKET, FIXTURE_SECRET, SIGNED_AT_MS + HOUR_MS)).toEqual({
      attemptId: "dev-fixture",
      sandboxId: "sbx-fixture",
      challengeId: "nginx-502-upstream",
    });
  });

  it("refuses the Go ticket once it has expired", () => {
    expect(verifyTicket(GO_SIGNED_TICKET, FIXTURE_SECRET, SIGNED_AT_MS + 2 * HOUR_MS)).toBeNull();
  });

  it.each([
    ["another secret", sign({ alg: "HS256" }, validClaims, "another-secret-another-secret-32b")],
    ["alg none", sign({ alg: "none" }, validClaims)],
    ["another audience", sign({ alg: "HS256" }, { ...validClaims, aud: "sandbox-attach" })],
    ["no sandbox", sign({ alg: "HS256" }, { ...validClaims, sandbox_id: undefined })],
    ["challenge path", sign({ alg: "HS256" }, { ...validClaims, challenge_id: "../etc" })],
    ["two parts", "abc.def"],
    ["garbage", "not-a-token"],
  ])("refuses %s", (_name, token) => {
    expect(verifyTicket(token, FIXTURE_SECRET, SIGNED_AT_MS)).toBeNull();
  });

  it("accepts the same claims signed correctly", () => {
    expect(verifyTicket(sign({ alg: "HS256" }, validClaims), FIXTURE_SECRET, SIGNED_AT_MS)?.attemptId).toBe("dev-1");
  });
});
