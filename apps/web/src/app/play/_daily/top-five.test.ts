import { describe, expect, it } from "vitest";
import { topFiveName, weekLabel } from "./top-five";

describe("weekLabel", () => {
  it("names the ISO week without a leading zero", () => {
    expect(weekLabel(new Date("2026-11-13T12:00:00Z"))).toBe("WK 46");
    expect(weekLabel(new Date("2026-01-05T00:00:00Z"))).toBe("WK 2");
  });

  it("counts the first days of January in the last week of the year before", () => {
    expect(weekLabel(new Date("2027-01-01T12:00:00Z"))).toBe("WK 53");
  });
});

describe("topFiveName", () => {
  it("shows a public handle and hides a player without one", () => {
    expect(topFiveName({ rank: 1, handle: "arslan", display_name: "Arslan", score: 120 })).toBe("@arslan");
    expect(topFiveName({ rank: 2, handle: null, display_name: null, score: 90 })).toBe("Hidden player");
  });
});
