"use client";

import { type CheckResponse, checkResponseSchema } from "@greenbuild/shared";
import { useCallback, useState } from "react";

export type CheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "done"; result: CheckResponse }
  | { kind: "error"; status: number };

const UNAVAILABLE = 503;

// useCheck runs the checker through the web app's API proxy, then lets the caller refresh the attempt.
export function useCheck(attemptId: string, afterCheck: () => Promise<unknown>) {
  const [state, setState] = useState<CheckState>({ kind: "idle" });
  const check = useCallback(async () => {
    setState({ kind: "checking" });
    const response = await fetch(`/api/attempts/${attemptId}/check`, { method: "POST", headers: { "x-greenbuild-request": "1" } }).catch(() => null);
    const parsed = response?.ok ? checkResponseSchema.safeParse(await response.json()) : null;
    setState(parsed?.success ? { kind: "done", result: parsed.data } : { kind: "error", status: response?.status ?? UNAVAILABLE });
    await afterCheck();
  }, [attemptId, afterCheck]);
  return { state, check };
}
