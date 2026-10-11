import { setTimeout as sleep } from "node:timers/promises";
import type { Database } from "@greenbuild/db";
import { DAILY_TRACKS, utcDay } from "@greenbuild/shared";
import { logger } from "../logger.js";
import { publishDaily } from "./publish.js";

const DAY_MS = 86_400_000;
const CHECK_INTERVAL_MS = 60_000;

// publishDue publishes today's and tomorrow's daily challenge for every track, so the next one is in
// place before 00:00 UTC (architecture.md, task 41a).
export async function publishDue(db: Database, now: Date): Promise<void> {
  const days = [utcDay(now), utcDay(new Date(now.getTime() + DAY_MS))];
  for (const track of DAILY_TRACKS) {
    for (const day of days) {
      await publishDaily(db, day, track);
    }
  }
}

// runDailyPublisher checks every minute until signal aborts; a failure is logged and retried, so a
// database restart or an empty catalog does not stop the worker.
export async function runDailyPublisher(db: Database, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    try {
      await publishDue(db, new Date());
    } catch (error) {
      logger.error("publish daily challenge failed; retrying", { error });
    }
    await sleep(CHECK_INTERVAL_MS, undefined, { signal }).catch(() => undefined);
  }
}
