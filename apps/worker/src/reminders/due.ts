import { localDay, type StreakState } from "@greenbuild/shared";

const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_MINUTE = 60;

// A player who has turned the streak reminder on (task 52), as the job reads them.
export interface ReminderCandidate {
  userId: string;
  email: string;
  timezone: string;
  reminderHour: number;
  lastRemindedDay: string | null;
  // The token of the player's one-click unsubscribe link.
  unsubscribeToken: string;
  streak: StreakState;
}

// localClock is the hour, minute and second at a moment in a timezone, on a 0–23 clock.
function localClock(moment: Date, timeZone: string): { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(moment);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((entry) => entry.type === type)?.value ?? 0);
  return { hour: part("hour"), minute: part("minute"), second: part("second") };
}

// secondsLeftInDay counts to midnight in the player's timezone.
export function secondsLeftInDay(moment: Date, timeZone: string): number {
  const { hour, minute, second } = localClock(moment, timeZone);
  return SECONDS_PER_DAY - (hour * SECONDS_PER_HOUR + minute * SECONDS_PER_MINUTE + second);
}

// reminderDue says whether a player gets the reminder now: their chosen hour has come in their own day,
// they have not solved today, and they were not reminded today. Later in the day still counts, so a
// reminder missed by a restart goes out late rather than never.
export function reminderDue(candidate: ReminderCandidate, now: Date): boolean {
  const today = localDay(now, candidate.timezone);
  if (candidate.lastRemindedDay === today || candidate.streak.lastDay === today) {
    return false;
  }
  return localClock(now, candidate.timezone).hour >= candidate.reminderHour;
}
