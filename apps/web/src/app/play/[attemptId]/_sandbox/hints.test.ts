import { describe, expect, it } from "vitest";
import { HINT_PENALTY_PERCENT, hintParts, xpPenaltyPercent } from "./hints";

describe("hintParts", () => {
  it("marks the text between backticks as code", () => {
    expect(hintParts("Check `nginx -t`, then `nginx -s reload`.")).toEqual([
      { text: "Check ", code: false },
      { text: "nginx -t", code: true },
      { text: ", then ", code: false },
      { text: "nginx -s reload", code: true },
      { text: ".", code: false },
    ]);
  });

  it("leaves a hint with an unmatched backtick as plain text", () => {
    expect(hintParts("Look in `/var/log")).toEqual([{ text: "Look in `/var/log", code: false }]);
  });
});

describe("xpPenaltyPercent", () => {
  it("adds the shared penalty for each opened hint, and stops at 100", () => {
    expect(HINT_PENALTY_PERCENT).toBe(20);
    expect([0, 1, 3, 6].map(xpPenaltyPercent)).toEqual([0, 20, 60, 100]);
  });
});
