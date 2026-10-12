import { and, attempts, type Database, eq, sql, streaks, users } from "@greenbuild/db";
import { applySolve, type AttemptFinished, localDay, NO_STREAK, type StreakState } from "@greenbuild/shared";
import type { FinishedHandler } from "../finished-consumer.js";
import { isVoided, notVoided } from "../reviews/voided.js";

type StreakRow = typeof streaks.$inferSelect;

// countStreak applies a solve to the player's streak on the calendar day it finished in their timezone
// (architecture.md, "Стрики", task 44). The row is locked, so two solves at once count one after the
// other; a redelivered event lands on a day already counted and changes nothing.
export async function countStreak(db: Database, event: AttemptFinished): Promise<void> {
  if (event.status !== "solved") {
    return;
  }
  await db.transaction(async (tx) => {
    const [user] = await tx.select({ timezone: users.timezone }).from(users).where(eq(users.id, event.user_id));
    if (!user) {
      throw new Error(`count streak: user ${event.user_id} not found`);
    }
    await tx.insert(streaks).values({ userId: event.user_id }).onConflictDoNothing();
    const [row] = await tx.select().from(streaks).where(eq(streaks.userId, event.user_id)).for("update");
    if (!row) {
      throw new Error(`count streak: no streak row for ${event.user_id}`);
    }
    const before = toState(row);
    const after = (await isVoided(tx, event.attempt_id))
      ? await rebuiltStreak(tx, event.user_id, user.timezone)
      : applySolve(before, localDay(new Date(event.finished_at), user.timezone));
    if (after !== before) {
      await tx
        .update(streaks)
        .set({ current: after.current, longest: after.longest, lastDay: after.lastDay, freezesAvailable: after.freezes })
        .where(eq(streaks.id, row.id));
    }
  });
}

// rebuiltStreak counts the streak again from every solve no review voided, oldest first, so a voided
// solve's day goes and the days after it count as they would have. Past days use today's timezone.
async function rebuiltStreak(tx: Pick<Database, "select">, userId: string, timezone: string): Promise<StreakState> {
  const solves = await tx
    .select({ finishedAt: attempts.finishedAt })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.status, "solved"), sql`${attempts.finishedAt} is not null`, notVoided))
    .orderBy(attempts.finishedAt);
  return solves.reduce((state, { finishedAt }) => (finishedAt ? applySolve(state, localDay(finishedAt, timezone)) : state), NO_STREAK);
}

function toState(row: StreakRow): StreakState {
  return { current: row.current, longest: row.longest, lastDay: row.lastDay, freezes: row.freezesAvailable };
}

export const streakHandler: FinishedHandler = { group: "worker-streak", name: "count streak", handle: ({ db }, event) => countStreak(db, event) };
