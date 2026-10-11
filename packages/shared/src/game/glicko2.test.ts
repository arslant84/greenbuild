import { describe, expect, it } from "vitest";
import { updateRating } from "./glicko2.js";

// Mark Glickman, "Example of the Glicko-2 system": a 1500 / 200 / 0.06 player with τ = 0.5 beats a
// 1400 / 30 player and loses to 1550 / 100 and 1700 / 300.
const PLAYER = { rating: 1500, deviation: 200, volatility: 0.06 };
const GAMES = [
  { opponent: { rating: 1400, deviation: 30 }, score: 1 },
  { opponent: { rating: 1550, deviation: 100 }, score: 0 },
  { opponent: { rating: 1700, deviation: 300 }, score: 0 },
];

describe("updateRating", () => {
  it("matches Glickman's worked example", () => {
    const rated = updateRating(PLAYER, GAMES);

    // The paper rounds its intermediate steps (μ′ = −0.2069) and prints 1464.06 and σ′ = 0.05999;
    // unrounded they are 1464.0507 and 0.059996.
    expect(rated.rating).toBeCloseTo(1464.06, 1);
    expect(rated.deviation).toBeCloseTo(151.52, 2);
    expect(rated.volatility).toBeCloseTo(0.05999, 4);
  });

  it("only widens the deviation in a period without games", () => {
    const rated = updateRating(PLAYER, []);

    expect(rated.rating).toBe(1500);
    expect(rated.volatility).toBe(0.06);
    // φ* = sqrt(φ² + σ²) on the Glicko-2 scale, back to 1500 ± 350.
    expect(rated.deviation).toBeCloseTo(Math.sqrt((200 / 173.7178) ** 2 + 0.06 ** 2) * 173.7178, 6);
  });

  it("raises a rating after an upset win and lowers it after an expected loss", () => {
    const favourite = { opponent: { rating: 1800, deviation: 50 }, score: 1 };
    const weak = { opponent: { rating: 1200, deviation: 50 }, score: 0 };

    expect(updateRating(PLAYER, [favourite]).rating).toBeGreaterThan(1500);
    expect(updateRating(PLAYER, [weak]).rating).toBeLessThan(1500);
  });
});
