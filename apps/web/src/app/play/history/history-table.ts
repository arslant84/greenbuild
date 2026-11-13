import { type AttemptHistoryItem, HISTORY_MAX } from "@greenbuild/shared";
import { type HistoryRow, historyRow } from "../_daily/history-view";

// The history screen (Stitch "Hotfix — Attempt History") lists as many finished attempts as one request answers.
export const FULL_HISTORY_PATH = `/v1/me/attempts?limit=${HISTORY_MAX}`;

// The screen's filter, from ?mode=: every attempt, or only daily or catalog ones.
export const HISTORY_MODES = ["all", "daily", "catalog"] as const;
export type HistoryMode = (typeof HISTORY_MODES)[number];

export interface HistoryTableRow extends HistoryRow {
  mode: string;
  hints: string;
}

export interface HistoryTotals {
  attempts: number;
  solved: number;
  xp: number;
}

// historyMode reads the filter from the query; anything else is all.
export function historyMode(param: string | string[] | undefined): HistoryMode {
  return HISTORY_MODES.find((mode) => mode === param) ?? "all";
}

// startedAt shows when an attempt started as the frame does, "Nov 12, 09:14 UTC".
export function startedAt(createdAt: string): string {
  const date = new Date(createdAt).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
  return `${date} UTC`;
}

// historyTableRows: the attempts of the chosen mode as the table's rows, in the API's order (newest first).
export function historyTableRows(attempts: AttemptHistoryItem[], mode: HistoryMode): HistoryTableRow[] {
  return attempts
    .filter((attempt) => mode === "all" || attempt.context === mode)
    .map((attempt) => ({ ...historyRow(attempt, startedAt(attempt.created_at)), mode: attempt.context.toUpperCase(), hints: String(attempt.hints_used) }));
}

// historyTotals sums the listed attempts for the stat cards: how many, how many solved, and their XP.
export function historyTotals(attempts: AttemptHistoryItem[]): HistoryTotals {
  return {
    attempts: attempts.length,
    solved: attempts.filter((attempt) => attempt.status === "solved").length,
    xp: attempts.reduce((sum, attempt) => sum + attempt.xp_earned, 0),
  };
}
