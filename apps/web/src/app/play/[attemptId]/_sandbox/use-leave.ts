"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

const CONFLICT = 409;

// useLeave ends the attempt through the web app's API proxy, then moves on: "Exit Attempt" back to
// the Daily screen, "Give up" to the debrief with the solution runbook. An attempt that is already
// over (409) moves on too; any other failure keeps the player here to try again.
export function useLeave(attemptId: string) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const leave = useCallback(
    async (destination: string) => {
      if (leaving) {
        return;
      }
      setLeaving(true);
      const response = await fetch(`/api/attempts/${attemptId}/abandon`, { method: "POST", headers: { "x-greenbuild-request": "1" } }).catch(() => null);
      if (response?.ok || response?.status === CONFLICT) {
        router.push(destination);
        return;
      }
      setLeaving(false);
    },
    [attemptId, leaving, router],
  );
  return {
    exit: () => void leave("/play"),
    giveUp: () => void leave(`/play/${attemptId}/result`),
  };
}
