import type { AttemptResponse } from "@greenbuild/shared";

export interface AttemptRow {
  id: string;
  status: AttemptResponse["status"];
  createdAt: Date;
  startedAt: Date | null;
  checksUsed: number;
}

export function toResponse(attempt: AttemptRow, challengeSlug: string): AttemptResponse {
  return {
    id: attempt.id,
    status: attempt.status,
    challenge_slug: challengeSlug,
    created_at: attempt.createdAt.toISOString(),
    started_at: attempt.startedAt?.toISOString() ?? null,
    checks_used: attempt.checksUsed,
  };
}
