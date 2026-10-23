"use client";

import type { AttemptResponse } from "@greenbuild/shared";
import { useCallback, useState } from "react";
import { useHintShortcut } from "../../../../ui/use-shortcut";

// useHints opens the attempt's next hint through the web app's API proxy, then refreshes the attempt,
// which carries every opened hint (task 35c). A hint opens only while the sandbox is ready for input.
export function useHints(attempt: AttemptResponse, ready: boolean, refresh: () => Promise<unknown>) {
  const [opening, setOpening] = useState(false);
  const canOpen = ready && !opening && attempt.hints.length < attempt.hints_total;
  const open = useCallback(async () => {
    setOpening(true);
    await fetch(`/api/attempts/${attempt.id}/hint`, { method: "POST", headers: { "x-greenbuild-request": "1" } }).catch(() => null);
    await refresh();
    setOpening(false);
  }, [attempt.id, refresh]);
  useHintShortcut(() => void open(), canOpen);
  return { canOpen, open };
}
