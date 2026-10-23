import type { ShareCard } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { shareView } from "./share-view";

const CARD: ShareCard = {
  display_name: "Ada Lovelace",
  handle: "ada",
  challenge_title: "The site returns 502",
  skills: ["linux", "nginx"],
  duration_ms: 222_000,
  xp_earned: 180,
  checks_passed: 1,
  checks_used: 2,
  streak: 13,
  solved_at: "2026-10-23T10:00:00.000Z",
};

describe("shareView", () => {
  it("shows the player, the time, the XP, the checks and the streak", () => {
    expect(shareView(CARD)).toMatchObject({
      name: "Ada Lovelace",
      handle: "@ada",
      solvedIn: "Solved in 03:42",
      xp: "+180 XP",
      checks: "1/2 checks passed",
      streak: "13 days",
      summary: "Ada Lovelace fixed “The site returns 502” in 03:42, verified in a real Linux sandbox on greenbuild.",
    });
  });

  it("names a player by handle without a display name, and stays anonymous without either", () => {
    expect(shareView({ ...CARD, display_name: null })).toMatchObject({ name: "@ada", handle: null });
    expect(shareView({ ...CARD, display_name: null, handle: null })).toMatchObject({ name: "A greenbuild player", handle: null });
  });

  it("shows no number for XP the worker has not credited yet, and one day in the singular", () => {
    expect(shareView({ ...CARD, xp_earned: null, streak: 1 })).toMatchObject({ xp: "— XP", streak: "1 day" });
  });
});
