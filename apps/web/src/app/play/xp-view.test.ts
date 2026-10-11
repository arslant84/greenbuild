import { describe, expect, it } from "vitest";
import { levelView, xpAmount } from "./xp-view";

describe("xpAmount", () => {
  it("shows the number, or — while there is none", () => {
    expect(xpAmount(120)).toBe("120");
    expect(xpAmount(0)).toBe("0");
    expect(xpAmount(null)).toBe("—");
  });
});

describe("levelView", () => {
  it("shows the level and the progress to the next one", () => {
    expect(levelView({ xp: 150, level: 1 })).toEqual({ level: "1", progress: 50 / 183, percent: "27%" });
  });

  it("stays empty without a profile", () => {
    expect(levelView(null)).toEqual({ level: "—", progress: 0, percent: "0%" });
  });
});
