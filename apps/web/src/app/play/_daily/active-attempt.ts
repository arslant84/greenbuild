import { ATTEMPT_MAX_CHECKS, type AttemptResponse } from "@greenbuild/shared";
import { formatClock } from "../../../ui/format";

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;

// What the Daily screen's "Attempt in progress" card says about the running attempt (task 21b), at a moment.
export interface ActiveAttemptFacts {
  timeLeft: string;
  checks: string;
  started: string;
}

// activeAttemptFacts: the time limit counts from the sandbox being ready, as on the sandbox screen; before
// that the sandbox is still starting.
export function activeAttemptFacts(attempt: AttemptResponse, limitSeconds: number, now: number): ActiveAttemptFacts {
  const checks = `${attempt.checks_used}/${ATTEMPT_MAX_CHECKS} checks used`;
  const started = startedAgo((now - Date.parse(attempt.created_at)) / MS_PER_SECOND);
  if (!attempt.started_at) {
    return { timeLeft: "sandbox starting", checks, started };
  }
  const elapsed = (now - Date.parse(attempt.started_at)) / MS_PER_SECOND;
  return { timeLeft: `${formatClock(Math.max(0, limitSeconds - elapsed))} left`, checks, started };
}

function startedAgo(seconds: number): string {
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  return minutes < 1 ? "started just now" : `started ${minutes} min ago`;
}
