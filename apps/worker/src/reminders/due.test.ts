import { NO_STREAK } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { type ReminderCandidate, reminderDue, secondsLeftInDay } from "./due.js";

// 2026-12-01 18:30 UTC is 19:30 in Berlin (UTC+1) and 13:30 in New York (UTC-5).
const NOW = new Date("2026-12-01T18:30:00Z");

function candidate(overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return { userId: "u", email: "ada@example.com", timezone: "Europe/Berlin", reminderHour: 19, lastRemindedDay: null, streak: NO_STREAK, ...overrides };
}

describe("reminderDue", () => {
  it("is due once the chosen hour has come in the player's own timezone", () => {
    expect(reminderDue(candidate(), NOW)).toBe(true);
    expect(reminderDue(candidate({ timezone: "America/New_York" }), NOW)).toBe(false);
  });

  it("is not due for a player who solved today in their timezone", () => {
    expect(reminderDue(candidate({ streak: { ...NO_STREAK, current: 3, lastDay: "2026-12-01" } }), NOW)).toBe(false);
  });

  it("goes once a day: not again after today's reminder", () => {
    expect(reminderDue(candidate({ lastRemindedDay: "2026-12-01" }), NOW)).toBe(false);
    expect(reminderDue(candidate({ lastRemindedDay: "2026-11-30" }), NOW)).toBe(true);
  });

  it("still goes later in the day when the chosen hour was missed", () => {
    expect(reminderDue(candidate({ reminderHour: 7 }), NOW)).toBe(true);
  });
});

describe("secondsLeftInDay", () => {
  it("counts to midnight in the player's timezone", () => {
    expect(secondsLeftInDay(NOW, "Europe/Berlin")).toBe(4.5 * 3600);
    expect(secondsLeftInDay(NOW, "UTC")).toBe(5.5 * 3600);
  });
});
