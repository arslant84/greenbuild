import type { CatalogEntry } from "@greenbuild/shared";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const pad = (value: number) => String(value).padStart(2, "0");

// solveTime shows a solve the way the Figma card does: "03m 42s".
export function solveTime(ms: number): string {
  const seconds = Math.floor(ms / MS_PER_SECOND);
  return `${pad(Math.floor(seconds / SECONDS_PER_MINUTE))}m ${pad(seconds % SECONDS_PER_MINUTE)}s`;
}

// slaLabel shows the time limit in whole minutes: "15m SLA".
export function slaLabel(timeLimitSec: number): string {
  return `${Math.ceil(timeLimitSec / SECONDS_PER_MINUTE)}m SLA`;
}

export type CardAction = { kind: "start" | "retry"; slug: string } | { kind: "resume" | "review"; href: string };

// cardAction is what the card's button does for the player's progress on that challenge.
export function cardAction(entry: CatalogEntry): CardAction {
  const { progress } = entry;
  if (progress.status === "in_progress" && progress.active_attempt_id) {
    return { kind: "resume", href: `/play/${progress.active_attempt_id}` };
  }
  if (progress.status === "solved" && progress.last_finished_attempt_id) {
    return {
      kind: "review",
      href: `/play/${progress.last_finished_attempt_id}/result`,
    };
  }
  return {
    kind: progress.status === "failed" ? "retry" : "start",
    slug: entry.slug,
  };
}
