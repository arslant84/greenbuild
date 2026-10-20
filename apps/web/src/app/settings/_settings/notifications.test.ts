import { describe, expect, it } from "vitest";
import { hourLabel, notificationsError, REMINDER_HOURS } from "./notifications";

describe("the streak reminder's settings", () => {
  it("offers every hour of the day as hh:00", () => {
    expect(REMINDER_HOURS).toHaveLength(24);
    expect(hourLabel(7)).toBe("07:00");
    expect(hourLabel(19)).toBe("19:00");
  });

  it("asks for an email address when the API refuses a reminder without one", () => {
    expect(notificationsError({ code: "unprocessable", message: "x" })).toBe("Add an email address to get streak reminders.");
    expect(notificationsError(null)).toBe("Your reminder could not be saved. Try again.");
  });
});
