import { errorResponseSchema } from "@greenbuild/shared";

// The settings screen's Timezone & Streak section (Figma 7:10273, task 47b): the zones to pick from, how
// the frame labels them, when a locked timezone may change, and when the player's day ends.

const DAY_MS = 86_400_000;
const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_MINUTE = 60;

// timezoneOptions are every IANA zone the runtime knows, with UTC and the player's own zone always present.
export function timezoneOptions(current: string): string[] {
  return [...new Set(["UTC", current, ...Intl.supportedValuesOf("timeZone")])].sort();
}

// offsetLabel is the frame's "Asia/Ashgabat (UTC+05:00)".
export function offsetLabel(zone: string, now: Date): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(now).find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const offset = name === "GMT" ? "+00:00" : name.slice("GMT".length);
  return `${zone} (UTC${offset})`;
}

export interface TimezoneLock {
  days: number;
  date: string;
}

// timezoneLock says how many days remain until the timezone may change, and on which date; null when it may now.
export function timezoneLock(lockedUntil: string | null, now: Date): TimezoneLock | null {
  if (!lockedUntil) {
    return null;
  }
  const until = new Date(lockedUntil);
  if (until <= now) {
    return null;
  }
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(until);
  return { days: Math.ceil((until.getTime() - now.getTime()) / DAY_MS), date };
}

// lockedUntilFrom reads when the timezone unlocks from the API's 409 answer, or null for any other answer.
export function lockedUntilFrom(body: unknown): string | null {
  const error = errorResponseSchema.safeParse(body);
  if (!error.success || error.data.code !== "conflict") {
    return null;
  }
  const details = error.data.details as { timezone_locked_until?: unknown } | undefined;
  return typeof details?.timezone_locked_until === "string" ? details.timezone_locked_until : null;
}

// untilDayEnds is the frame's "in 4h 32m": how long until midnight in the player's zone, when the day resets.
export function untilDayEnds(zone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" }).formatToParts(now);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  const left = SECONDS_PER_DAY - (part("hour") * SECONDS_PER_HOUR + part("minute") * SECONDS_PER_MINUTE + part("second"));
  return `in ${Math.floor(left / SECONDS_PER_HOUR)}h ${Math.floor((left % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)}m`;
}
