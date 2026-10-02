"use client";

import { type AttemptResponse, attemptResponseSchema } from "@greenbuild/shared";
import { useCallback, useEffect, useState } from "react";

const POLL_MS = 1_000;
const FINISHED: AttemptResponse["status"][] = ["solved", "failed", "expired", "abandoned"];

export function isFinished(status: AttemptResponse["status"]): boolean {
  return FINISHED.includes(status);
}

// fetchAttempt reads the attempt through the web app's API proxy; each read of a ready attempt
// carries a fresh 60-second attach token.
export async function fetchAttempt(attemptId: string): Promise<AttemptResponse | null> {
  const response = await fetch(`/api/attempts/${attemptId}`, { cache: "no-store" }).catch(() => null);
  if (!response?.ok) {
    return null;
  }
  const parsed = attemptResponseSchema.safeParse(await response.json());
  return parsed.success ? parsed.data : null;
}

// useAttempt keeps the attempt current while its sandbox starts; refresh() reads it again on demand.
export function useAttempt(initial: AttemptResponse) {
  const [attempt, setAttempt] = useState(initial);
  const refresh = useCallback(async () => {
    const latest = await fetchAttempt(initial.id);
    if (latest) {
      setAttempt(latest);
    }
    return latest;
  }, [initial.id]);
  useEffect(() => {
    if (attempt.status !== "starting") {
      return undefined;
    }
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [attempt.status, refresh]);
  return { attempt, refresh };
}
