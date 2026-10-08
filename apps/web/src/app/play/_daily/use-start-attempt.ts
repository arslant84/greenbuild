"use client";

import { attemptResponseSchema } from "@greenbuild/shared";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { failureMessage } from "./start-messages";

// useStartAttempt creates the attempt and opens its sandbox screen, which waits for the sandbox.
export function useStartAttempt(challengeSlug: string) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = useCallback(async (): Promise<void> => {
    setStarting(true);
    setError(null);
    const response = await fetch("/api/attempts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-greenbuild-request": "1",
      },
      body: JSON.stringify({ challenge_slug: challengeSlug }),
    }).catch(() => null);
    const attempt = response?.ok ? attemptResponseSchema.safeParse(await response.json()) : null;
    if (attempt?.success) {
      router.push(`/play/${attempt.data.id}`);
      return;
    }
    setError(await failureMessage(response));
    setStarting(false);
  }, [challengeSlug, router]);
  return { start, starting, error };
}
