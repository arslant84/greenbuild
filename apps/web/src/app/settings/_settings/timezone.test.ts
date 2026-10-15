import { describe, expect, it } from "vitest";
import { lockedUntilFrom, offsetLabel, timezoneLock, timezoneOptions, untilDayEnds } from "./timezone";

const NOW = new Date("2026-10-14T12:00:00Z");

describe("timezoneOptions", () => {
  it("lists the runtime's zones with UTC, sorted", () => {
    const options = timezoneOptions("Asia/Ashgabat");
    expect(options).toContain("UTC");
    expect(options).toContain("Asia/Ashgabat");
    expect(options).toEqual([...options].sort());
  });
});

describe("offsetLabel", () => {
  it("labels a zone with its offset from UTC, as the frame does", () => {
    expect(offsetLabel("Asia/Ashgabat", NOW)).toBe("Asia/Ashgabat (UTC+05:00)");
    expect(offsetLabel("UTC", NOW)).toBe("UTC (UTC+00:00)");
    expect(offsetLabel("America/New_York", NOW)).toBe("America/New_York (UTC-04:00)");
  });
});

describe("timezoneLock", () => {
  it("counts the days left and the date the timezone unlocks", () => {
    expect(timezoneLock("2026-11-13T12:00:00.000Z", NOW)).toEqual({ days: 30, date: "Nov 13, 2026" });
    expect(timezoneLock("2026-10-14T13:00:00.000Z", NOW)).toEqual({ days: 1, date: "Oct 14, 2026" });
  });

  it("is open without a lock or once it passed", () => {
    expect(timezoneLock(null, NOW)).toBeNull();
    expect(timezoneLock("2026-10-01T00:00:00.000Z", NOW)).toBeNull();
  });
});

describe("lockedUntilFrom", () => {
  it("reads the unlock date from the API's 409 answer only", () => {
    expect(lockedUntilFrom({ code: "conflict", message: "x", details: { timezone_locked_until: "2026-11-13T12:00:00.000Z" } })).toBe("2026-11-13T12:00:00.000Z");
    expect(lockedUntilFrom({ code: "conflict", message: "Handle is taken" })).toBeNull();
    expect(lockedUntilFrom({ code: "validation_failed", message: "x" })).toBeNull();
  });
});

describe("untilDayEnds", () => {
  it("says how long until midnight in the player's zone", () => {
    // 12:00 UTC is 17:00 in Ashgabat (UTC+5): the day ends in 7 hours.
    expect(untilDayEnds("Asia/Ashgabat", NOW)).toBe("in 7h 0m");
    expect(untilDayEnds("UTC", new Date("2026-10-14T19:27:30Z"))).toBe("in 4h 32m");
  });
});
