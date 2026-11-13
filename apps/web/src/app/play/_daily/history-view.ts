import { type AttemptHistoryItem, utcDay } from "@greenbuild/shared";
import { incidentId } from "../../../ui/incident";

const DAY_MS = 86_400_000;
const RECENT_DAYS = 5;
const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;

// The player's finished attempts (GET /v1/me/attempts), newest first, for the Daily screen's history.
export const HISTORY_PATH = "/v1/me/attempts?limit=20";

export type Outcome = "PASSED" | "FAILED" | "EXPIRED" | "ABANDONED";

export interface HistoryRow {
  id: string;
  day: string;
  incident: string;
  title: string;
  slug: string;
  outcome: Outcome;
  time: string;
  xp: string;
}

const OUTCOMES: Record<AttemptHistoryItem["status"], Outcome> = { solved: "PASSED", failed: "FAILED", expired: "EXPIRED", abandoned: "ABANDONED" };

// solveTime shows a duration as the frame does, "04m 15s"; an attempt that never had a ready sandbox has none.
export function solveTime(durationMs: number | null): string {
  if (durationMs === null) {
    return "—";
  }
  const seconds = Math.round(durationMs / MS_PER_SECOND);
  return `${String(Math.floor(seconds / SECONDS_PER_MINUTE)).padStart(2, "0")}m ${String(seconds % SECONDS_PER_MINUTE).padStart(2, "0")}s`;
}

export function xpEarned(xp: number): string {
  return xp > 0 ? `+${xp} XP` : "—";
}

// dayLabel names the UTC day an attempt started on, relative to now: Today, Yesterday, or the date.
function dayLabel(createdAt: string, now: Date): string {
  const day = utcDay(new Date(createdAt));
  if (day === utcDay(now)) {
    return "Today";
  }
  if (day === utcDay(new Date(now.getTime() - DAY_MS))) {
    return "Yesterday";
  }
  return new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// historyRow shows an attempt as a row of the player's history; day says when it started.
export function historyRow(attempt: AttemptHistoryItem, day: string): HistoryRow {
  return {
    id: attempt.id,
    day,
    incident: incidentId(attempt.id),
    title: attempt.challenge_title,
    slug: attempt.challenge_slug,
    outcome: OUTCOMES[attempt.status],
    time: solveTime(attempt.duration_ms),
    xp: xpEarned(attempt.xp_earned),
  };
}

// recentRows: the attempts of the last five UTC days, today included, as the frame's rows.
export function recentRows(attempts: AttemptHistoryItem[], now: Date): HistoryRow[] {
  const oldestDay = utcDay(new Date(now.getTime() - (RECENT_DAYS - 1) * DAY_MS));
  return attempts
    .filter((attempt) => utcDay(new Date(attempt.created_at)) >= oldestDay)
    .map((attempt) => historyRow(attempt, dayLabel(attempt.created_at, now)));
}

// yesterdaysDaily is the player's newest attempt at yesterday's daily challenge, if they made one.
export function yesterdaysDaily(attempts: AttemptHistoryItem[], now: Date): AttemptHistoryItem | null {
  const yesterday = utcDay(new Date(now.getTime() - DAY_MS));
  return attempts.find((attempt) => attempt.context === "daily" && utcDay(new Date(attempt.created_at)) === yesterday) ?? null;
}
