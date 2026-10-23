import type { AttemptResponse } from "@greenbuild/shared";

export interface AttemptRow {
  id: string;
  status: AttemptResponse["status"];
  createdAt: Date;
  startedAt: Date | null;
  checksUsed: number;
  hintsUsed: number;
}

// The attempt's challenge version: its slug and its hints, weakest first.
export interface AttemptChallenge {
  slug: string;
  hints: string[] | null;
}

export function toResponse(attempt: AttemptRow, challenge: AttemptChallenge): AttemptResponse {
  const hints = challenge.hints ?? [];
  return {
    id: attempt.id,
    status: attempt.status,
    challenge_slug: challenge.slug,
    created_at: attempt.createdAt.toISOString(),
    started_at: attempt.startedAt?.toISOString() ?? null,
    checks_used: attempt.checksUsed,
    hints: hints.slice(0, attempt.hintsUsed),
    hints_total: hints.length,
  };
}
