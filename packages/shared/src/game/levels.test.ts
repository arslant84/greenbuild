import { describe, expect, it } from "vitest";
import { levelForXp, levelProgress, xpForLevel } from "./levels.js";

describe("levels", () => {
  it("needs 100 × n^1.5 XP in total for level n", () => {
    expect([1, 2, 3, 4].map(xpForLevel)).toEqual([100, 283, 520, 800]);
  });

  it.each([
    [0, 0],
    [99, 0],
    [100, 1],
    [282, 1],
    [283, 2],
    [800, 4],
    [10_000, 21],
  ])("puts %i XP at level %i", (xp, level) => {
    expect(levelForXp(xp)).toBe(level);
  });

  it("measures progress from the current level to the next", () => {
    expect(levelProgress(0)).toBe(0);
    expect(levelProgress(50)).toBe(0.5);
    expect(levelProgress(100)).toBe(0);
    expect(levelProgress(191)).toBeCloseTo(91 / 183);
  });
});
