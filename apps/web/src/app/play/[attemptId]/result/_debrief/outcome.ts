import type { AttemptResult } from "@greenbuild/shared";

export interface Outcome {
  label: string;
  // Breadcrumb and header wording, e.g. "INCIDENT RESOLVED".
  tag: string;
  headerStatus: string;
  tone: "ok" | "danger" | "warn";
}

// The frame draws the solved outcome; failed and expired reuse it with the danger and warning tones.
const OUTCOMES: Record<AttemptResult["status"], Outcome> = {
  solved: { label: "SOLVED", tag: "INCIDENT RESOLVED", headerStatus: "RESOLVED", tone: "ok" },
  failed: { label: "FAILED", tag: "INCIDENT UNRESOLVED", headerStatus: "FAILED", tone: "danger" },
  expired: { label: "EXPIRED", tag: "TIME LIMIT REACHED", headerStatus: "EXPIRED", tone: "warn" },
  abandoned: { label: "ABANDONED", tag: "ATTEMPT ABANDONED", headerStatus: "ABANDONED", tone: "warn" },
  starting: { label: "STARTING", tag: "SANDBOX STARTING", headerStatus: "STARTING", tone: "warn" },
  ready: { label: "IN PROGRESS", tag: "INCIDENT OPEN", headerStatus: "IN PROGRESS", tone: "warn" },
};

export const TONE_TEXT: Record<Outcome["tone"], string> = { ok: "text-ok", danger: "text-danger", warn: "text-warn" };
export const TONE_BG: Record<Outcome["tone"], string> = { ok: "bg-ok", danger: "bg-danger", warn: "bg-warn" };

export function outcomeOf(status: AttemptResult["status"]): Outcome {
  return OUTCOMES[status];
}

// checkSummary counts the passing runs, as the frame's "4/4 checks passed".
export function checkSummary(result: AttemptResult): string {
  const passed = result.checks.filter((check) => check.passed).length;
  return `${passed}/${result.checks.length} checks passed`;
}
