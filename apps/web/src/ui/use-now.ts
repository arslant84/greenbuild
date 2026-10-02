"use client";

import { useEffect, useState } from "react";

const SECOND_MS = 1_000;

// useNow re-renders every second with the current time, for timers.
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}
