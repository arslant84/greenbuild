import { describe, expect, it } from "vitest";
import { type SolveXpInput, solveXp, speedBonus } from "./xp.js";

const plain: SolveXpInput = { difficulty: 4, durationMs: null, medianDurationMs: null, hintsUsed: 0, daily: false, newSkills: 0 };

describe("solveXp", () => {
  it("gives 10 XP per difficulty point for a plain solve", () => {
    expect(solveXp(plain)).toEqual({ solve: 40, newSkills: 0 });
  });

  it("takes 20% of the base per hint and never goes below zero", () => {
    expect(solveXp({ ...plain, hintsUsed: 1 }).solve).toBe(32);
    expect(solveXp({ ...plain, hintsUsed: 3 }).solve).toBe(16);
    expect(solveXp({ ...plain, hintsUsed: 6 }).solve).toBe(0);
  });

  it("multiplies the daily challenge by 1.5", () => {
    expect(solveXp({ ...plain, daily: true }).solve).toBe(60);
  });

  it("adds 25 XP per skill solved for the first time", () => {
    expect(solveXp({ ...plain, newSkills: 2 }).newSkills).toBe(50);
  });

  it("combines speed, hints and the daily multiplier", () => {
    // 40 × 1.5 (half the median) × 0.8 (one hint) × 1.5 (daily) = 72
    expect(solveXp({ ...plain, durationMs: 60_000, medianDurationMs: 120_000, hintsUsed: 1, daily: true }).solve).toBe(72);
  });
});

describe("speedBonus", () => {
  it.each([
    ["half the median or faster", 30_000, 0.5],
    ["three quarters of the median", 90_000, 0.25],
    ["the median", 120_000, 0],
    ["slower than the median", 300_000, 0],
  ])("is right for %s", (_name, durationMs, bonus) => {
    expect(speedBonus(durationMs, 120_000)).toBeCloseTo(bonus);
  });

  it("is zero without a duration or a median", () => {
    expect(speedBonus(null, 120_000)).toBe(0);
    expect(speedBonus(60_000, null)).toBe(0);
  });
});
