"use client";

import { formatElapsed } from "../../../ui/format";
import { useNow } from "../../../ui/use-now";
import { secondsUntilNextDaily } from "./next-scenario";

// The time left until tomorrow's challenge, ticking every second. The server's and the browser's clocks
// differ by a moment, so the first render's text may too.
export function NextScenarioClock() {
  const left = secondsUntilNextDaily(new Date(useNow()));
  return <span suppressHydrationWarning>{formatElapsed(left)}</span>;
}
