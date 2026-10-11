import { describe, expect, it } from "vitest";
import { isoWeek, isoWeekStart, leaderboardKeys } from "./leaderboards.js";

describe("isoWeek", () => {
  it.each([
    ["2026-11-09T00:00:00Z", "2026-46"],
    ["2026-11-15T23:59:59Z", "2026-46"],
    ["2026-11-16T00:00:00Z", "2026-47"],
    // 1 January 2027 is a Friday, so it belongs to the last ISO week of 2026.
    ["2027-01-01T12:00:00Z", "2026-53"],
    ["2026-01-01T12:00:00Z", "2026-01"],
  ])("puts %s in week %s", (moment, week) => {
    expect(isoWeek(new Date(moment))).toBe(week);
  });

  it("starts the week on Monday 00:00 UTC", () => {
    expect(isoWeekStart(new Date("2026-11-15T23:59:59Z")).toISOString()).toBe("2026-11-09T00:00:00.000Z");
  });
});

describe("leaderboardKeys", () => {
  it("names the plan's sorted sets", () => {
    expect(leaderboardKeys.globalWeekly("2026-46")).toBe("lb:global:weekly:2026-46");
    expect(leaderboardKeys.countryWeekly("KZ", "2026-46")).toBe("lb:country:KZ:weekly:2026-46");
    expect(leaderboardKeys.skill("linux")).toBe("lb:skill:linux");
    expect(leaderboardKeys.daily("2026-11-09", "linux")).toBe("lb:daily:2026-11-09:linux");
  });
});
