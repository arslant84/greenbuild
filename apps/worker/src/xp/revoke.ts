import { cheatReviews, eq, xpLedger } from "@greenbuild/db";
import { type AttemptFinished, isoWeek } from "@greenbuild/shared";
import type { HandlerDeps } from "../finished-consumer.js";
import { syncWeeklyXp } from "../leaderboards/boards.js";

// revokeVoidedXp takes back the XP of an attempt a review voided or banned (task 49c) and answers
// whether it did. The review sends attempt.finished again, so this runs after the decision. The
// ledger rows go, so every XP sum (profile, today, weekly boards) drops them; audit_log keeps the
// decision.
export async function revokeVoidedXp(deps: HandlerDeps, event: AttemptFinished): Promise<boolean> {
  const [review] = await deps.db.select({ decision: cheatReviews.decision }).from(cheatReviews).where(eq(cheatReviews.attemptId, event.attempt_id));
  if (!review || review.decision === "clear") {
    return false;
  }
  const removed = await deps.db.delete(xpLedger).where(eq(xpLedger.attemptId, event.attempt_id)).returning({ createdAt: xpLedger.createdAt });
  // The award's week is normally the finish's, which a retry after the deletion still finds.
  const weeks = new Map<string, Date>();
  for (const moment of [new Date(event.finished_at), ...removed.map((row) => row.createdAt)]) {
    weeks.set(isoWeek(moment), moment);
  }
  for (const moment of weeks.values()) {
    await syncWeeklyXp(deps, event.user_id, moment);
  }
  return true;
}
