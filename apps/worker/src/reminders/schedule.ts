import { setTimeout as sleep } from "node:timers/promises";
import type { Database } from "@greenbuild/db";
import { logger } from "../logger.js";
import type { Mailer } from "../privacy/export-job.js";
import { sendDueReminders } from "./send.js";

// Reminders go at whole local hours, so a check every five minutes sends them at most that late.
const CHECK_INTERVAL_MS = 5 * 60_000;

// runStreakReminders sends the due streak reminders (task 52) until signal aborts; a failure is logged and
// retried at the next check.
export async function runStreakReminders({ db, mail, webUrl }: { db: Database; mail: Mailer; webUrl: string }, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    try {
      const sent = await sendDueReminders({ db, mail, webUrl }, new Date());
      if (sent > 0) {
        logger.info("streak reminders sent", { sent });
      }
    } catch (error) {
      logger.error("streak reminders failed; retrying", { error });
    }
    await sleep(CHECK_INTERVAL_MS, undefined, { signal }).catch(() => undefined);
  }
}
