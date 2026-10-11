import { describe, expect, it } from "vitest";
import { applySolve, localDay, NO_STREAK, type StreakState, visibleStreak } from "./streaks.js";

function solveOn(days: string[], from: StreakState = NO_STREAK): StreakState {
  return days.reduce(applySolve, from);
}

describe("applySolve", () => {
  it("starts at 1 and grows by one per consecutive day", () => {
    expect(solveOn(["2026-11-01", "2026-11-02", "2026-11-03"])).toEqual({ current: 3, longest: 3, lastDay: "2026-11-03", freezes: 0 });
  });

  it("counts a day once and ignores a day that arrives late", () => {
    const state = solveOn(["2026-11-01", "2026-11-02"]);

    expect(applySolve(state, "2026-11-02")).toBe(state);
    expect(applySolve(state, "2026-11-01")).toBe(state);
  });

  it("earns a freeze every 7 days, at most 3", () => {
    const days = Array.from({ length: 28 }, (_, index) => `2026-11-${String(index + 1).padStart(2, "0")}`);

    expect(solveOn(days.slice(0, 6)).freezes).toBe(0);
    expect(solveOn(days.slice(0, 7)).freezes).toBe(1);
    expect(solveOn(days).freezes).toBe(3);
  });

  it("spends freezes on missed days and keeps the streak", () => {
    const state: StreakState = { current: 10, longest: 10, lastDay: "2026-11-10", freezes: 2 };

    expect(applySolve(state, "2026-11-13")).toEqual({ current: 11, longest: 11, lastDay: "2026-11-13", freezes: 0 });
  });

  it("starts over when more days were missed than there are freezes", () => {
    const state: StreakState = { current: 10, longest: 12, lastDay: "2026-11-10", freezes: 1 };

    expect(applySolve(state, "2026-11-13")).toEqual({ current: 1, longest: 12, lastDay: "2026-11-13", freezes: 1 });
  });
});

describe("visibleStreak", () => {
  const state: StreakState = { current: 5, longest: 5, lastDay: "2026-11-10", freezes: 1 };

  it("shows the streak while missed days can still be covered", () => {
    expect(visibleStreak(state, "2026-11-10")).toBe(5);
    expect(visibleStreak(state, "2026-11-11")).toBe(5);
    expect(visibleStreak(state, "2026-11-12")).toBe(5);
  });

  it("shows 0 once it is broken, and 0 before the first solve", () => {
    expect(visibleStreak(state, "2026-11-13")).toBe(0);
    expect(visibleStreak(NO_STREAK, "2026-11-13")).toBe(0);
  });
});

describe("localDay", () => {
  it("is the calendar day in the player's timezone", () => {
    const moment = new Date("2026-11-01T22:30:00Z");

    expect(localDay(moment, "UTC")).toBe("2026-11-01");
    expect(localDay(moment, "Asia/Almaty")).toBe("2026-11-02");
    expect(localDay(moment, "America/New_York")).toBe("2026-11-01");
  });
});
