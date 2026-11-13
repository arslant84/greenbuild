import { describe, expect, it } from "vitest";
import { secondsUntilNextDaily } from "./next-scenario";

describe("secondsUntilNextDaily", () => {
  it("counts down to the coming 00:00 UTC", () => {
    expect(secondsUntilNextDaily(new Date("2026-11-13T21:30:00Z"))).toBe(2.5 * 3600);
  });

  it("is a whole day at midnight UTC, when today's challenge has just arrived", () => {
    expect(secondsUntilNextDaily(new Date("2026-11-13T00:00:00Z"))).toBe(24 * 3600);
  });

  it("rounds a part of a second up, so it never shows zero before the day turns", () => {
    expect(secondsUntilNextDaily(new Date("2026-11-13T23:59:59.400Z"))).toBe(1);
  });

  it("crosses the end of a month and a year", () => {
    expect(secondsUntilNextDaily(new Date("2026-12-31T23:00:00Z"))).toBe(3600);
  });
});
