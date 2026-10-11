// architecture.md, "Лидерборды (Redis sorted sets)" (task 45a). Members are user ids; the API turns them
// into handles. Weekly boards follow the ISO week in UTC, which starts on Monday.
const DAY_MS = 86_400_000;
const DAYS_PER_WEEK = 7;
const THURSDAY = 4;

// isoWeekStart is Monday 00:00 UTC of the ISO week a moment falls in.
export function isoWeekStart(moment: Date): Date {
  const day = new Date(Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth(), moment.getUTCDate()));
  const weekday = day.getUTCDay() || DAYS_PER_WEEK;
  return new Date(day.getTime() - (weekday - 1) * DAY_MS);
}

// isoWeek is the ISO 8601 week of a moment in UTC as yyyy-ww, e.g. 2026-45; a week belongs to the year
// of its Thursday.
export function isoWeek(moment: Date): string {
  const thursday = new Date(isoWeekStart(moment).getTime() + (THURSDAY - 1) * DAY_MS);
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS / DAYS_PER_WEEK) + 1;
  return `${year}-${String(week).padStart(2, "0")}`;
}

export const leaderboardKeys = {
  // XP earned in the week; a new key each Monday.
  globalWeekly: (week: string): string => `lb:global:weekly:${week}`,
  countryWeekly: (country: string, week: string): string => `lb:country:${country}:weekly:${week}`,
  // The skill rating, kept for good.
  skill: (skill: string): string => `lb:skill:${skill}`,
  // Solve time of the daily challenge in milliseconds; lower is better.
  daily: (day: string, track: string): string => `lb:daily:${day}:${track}`,
};
