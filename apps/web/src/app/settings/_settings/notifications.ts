import type { ErrorResponse } from "@greenbuild/shared";

const HOURS_PER_DAY = 24;

// The hours the streak reminder can go at, in the player's own timezone (task 52).
export const REMINDER_HOURS = Array.from({ length: HOURS_PER_DAY }, (_, hour) => hour);

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

// notificationsError says why the reminder could not be saved: the API refuses a reminder to an account
// without an email address (422).
export function notificationsError(error: ErrorResponse | null): string {
  if (error?.code === "unprocessable") {
    return "Add an email address to get streak reminders.";
  }
  return "Your reminder could not be saved. Try again.";
}
