"use client";

import type { AttemptResponse } from "@greenbuild/shared";
import { useCallback, useEffect, useState } from "react";
import type { ConnectionStatus } from "../protocol";

export const MAX_RECONNECTS = 5;
const RETRY_MS = 3_000;

// useReconnect keeps a terminal token. After a dropped connection it reads the attempt again for a
// fresh 60-second token, every few seconds up to MAX_RECONNECTS times, or at once on reconnectNow.
export function useReconnect(initialToken: string, status: ConnectionStatus, refresh: () => Promise<AttemptResponse | null>) {
  const [token, setToken] = useState(initialToken);
  const [retry, setRetry] = useState(0);
  const reconnectNow = useCallback(async () => {
    setRetry((count) => count + 1);
    const latest = await refresh();
    if (latest?.status === "ready" && latest.attach_token) {
      setToken(latest.attach_token);
    }
  }, [refresh]);
  useEffect(() => {
    if (status === "connected") {
      setRetry(0);
    }
    if (status !== "disconnected" || retry >= MAX_RECONNECTS) {
      return undefined;
    }
    const timer = setTimeout(() => void reconnectNow(), RETRY_MS);
    return () => clearTimeout(timer);
  }, [status, retry, reconnectNow]);
  return { token, retry: Math.max(retry, 1), reconnectNow };
}
