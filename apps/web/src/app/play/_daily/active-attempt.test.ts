import type { AttemptResponse } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { activeAttemptFacts } from "./active-attempt";

const CREATED = Date.parse("2026-10-23T10:00:00.000Z");
const LIMIT_SEC = 900;
const MINUTE_MS = 60_000;
const attempt: AttemptResponse = {
  id: "0199a5c4-7b2e-7c3a-9f10-2b3c4d5e6f70",
  status: "ready",
  challenge_slug: "nginx-502-upstream",
  created_at: new Date(CREATED).toISOString(),
  started_at: new Date(CREATED + MINUTE_MS / 4).toISOString(),
  checks_used: 2,
  hints: [],
  hints_total: 3,
};

describe("activeAttemptFacts", () => {
  it("counts the time left from the sandbox being ready, and the minutes since the start", () => {
    expect(activeAttemptFacts(attempt, LIMIT_SEC, CREATED + 3 * MINUTE_MS + MINUTE_MS / 4)).toEqual({
      timeLeft: "12:00 left",
      checks: "2/10 checks used",
      started: "started 3 min ago",
    });
  });

  it("says the sandbox is starting before it is ready, and the start was just now", () => {
    const facts = activeAttemptFacts({ ...attempt, status: "starting", started_at: null }, LIMIT_SEC, CREATED + MINUTE_MS / 2);
    expect([facts.timeLeft, facts.started]).toEqual(["sandbox starting", "started just now"]);
  });

  it("never shows less than no time left", () => {
    expect(activeAttemptFacts(attempt, LIMIT_SEC, CREATED + 20 * MINUTE_MS).timeLeft).toBe("00:00 left");
  });
});
