import { describe, expect, it } from "vitest";
import { type StreakReminder, streakReminderEmail } from "./streak-reminder.js";

const SECONDS_LEFT = 4 * 3600 + 30 * 60;

function reminder(overrides: Partial<StreakReminder> = {}): StreakReminder {
  return {
    streak: 11,
    freezes: 2,
    challenge: { title: "The site returns 502", skills: ["linux", "nginx"], difficulty: 4, timeLimitSec: 900 },
    secondsLeft: SECONDS_LEFT,
    playUrl: "https://greenbuild.dev/play",
    settingsUrl: "https://greenbuild.dev/settings#section-notifications",
    ...overrides,
  };
}

describe("streakReminderEmail", () => {
  it("names the next streak day, today's challenge and the time left", () => {
    const email = streakReminderEmail(reminder());

    expect(email.subject).toBe("Day 12: don't break the chain");
    expect(email.html).toContain("ACTIVE STREAK: 11 DAYS");
    expect(email.html).toContain("DAY ENDS IN 04:30");
    expect(email.html).toContain("The site returns 502");
    expect(email.html).toContain("TIME LIMIT: 15 MIN");
    expect(email.html).toContain("Streak freezes available: 2 of 3");
  });

  it("states the XP a daily solve earns without hints: 10 per difficulty point, times 1.5", () => {
    expect(streakReminderEmail(reminder()).html).toContain("+60 XP without hints");
  });

  it("asks a player without a streak to start one, with no streak pill", () => {
    const email = streakReminderEmail(reminder({ streak: 0 }));

    expect(email.subject).toBe("Today's challenge is waiting");
    expect(email.html).not.toContain("ACTIVE STREAK");
    expect(email.text).toContain("to start a streak");
  });

  it("leaves the challenge card out when no daily challenge is published", () => {
    expect(streakReminderEmail(reminder({ challenge: null })).html).not.toContain("Today's challenge</span>");
  });

  it("links to play and to turning reminders off, in HTML and in text", () => {
    const email = streakReminderEmail(reminder());

    expect(email.html).toContain('href="https://greenbuild.dev/play"');
    expect(email.html).toContain('href="https://greenbuild.dev/settings#section-notifications"');
    expect(email.text).toContain("https://greenbuild.dev/play");
    expect(email.text).toContain("Turn reminders off: https://greenbuild.dev/settings#section-notifications");
  });

  it("escapes a challenge title", () => {
    const email = streakReminderEmail(reminder({ challenge: { title: "<b>502</b>", skills: [], difficulty: 1, timeLimitSec: 600 } }));

    expect(email.html).toContain("&lt;b&gt;502&lt;/b&gt;");
  });
});
