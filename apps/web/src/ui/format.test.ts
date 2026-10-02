import { describe, expect, it } from "vitest";
import { formatClock, formatElapsed } from "./format";

describe("formatClock", () => {
  it.each([
    [900, "15:00"],
    [754, "12:34"],
    [5, "00:05"],
    [0, "00:00"],
    [-3, "00:00"],
    [59.9, "00:59"],
  ])("shows %d seconds as %s", (seconds, clock) => {
    expect(formatClock(seconds)).toBe(clock);
  });
});

describe("formatElapsed", () => {
  it.each([
    [872, "00:14:32"],
    [3725, "01:02:05"],
    [-1, "00:00:00"],
  ])("shows %d seconds as %s", (seconds, clock) => {
    expect(formatElapsed(seconds)).toBe(clock);
  });
});
