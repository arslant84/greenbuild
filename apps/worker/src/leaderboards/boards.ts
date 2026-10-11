import { and, attempts, dailyChallenges, eq, sql, users, userSkills, xpLedger } from "@greenbuild/db";
import { type AttemptFinished, isoWeek, isoWeekStart, leaderboardKeys, utcDay } from "@greenbuild/shared";
import type { FinishedHandler, HandlerDeps } from "../finished-consumer.js";

const WEEK_MS = 7 * 86_400_000;

// Every update writes an absolute score computed from the database, so a redelivered event or a retry
// after a failure leaves the boards right (architecture.md, "Лидерборды", task 45a).

// syncWeeklyXp sets the player's XP for the ISO week of moment on the global board and, when they have
// a country, on their country's board.
export async function syncWeeklyXp({ db, boards }: HandlerDeps, userId: string, moment: Date): Promise<void> {
  const start = isoWeekStart(moment);
  const end = new Date(start.getTime() + WEEK_MS);
  const [row] = await db
    .select({ xp: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int`, country: sql<string | null>`max(${users.country})` })
    .from(users)
    .leftJoin(xpLedger, and(eq(xpLedger.userId, users.id), sql`${xpLedger.createdAt} >= ${start.toISOString()}`, sql`${xpLedger.createdAt} < ${end.toISOString()}`))
    .where(eq(users.id, userId));
  const week = isoWeek(moment);
  const member = { score: row?.xp ?? 0, value: userId };
  await boards.zAdd(leaderboardKeys.globalWeekly(week), member);
  if (row?.country) {
    await boards.zAdd(leaderboardKeys.countryWeekly(row.country, week), member);
  }
}

// syncSkillBoards sets each of the player's skill ratings on that skill's board.
export async function syncSkillBoards({ db, boards }: HandlerDeps, userId: string): Promise<void> {
  const skills = await db.select({ skill: userSkills.skill, rating: userSkills.rating }).from(userSkills).where(eq(userSkills.userId, userId));
  for (const { skill, rating } of skills) {
    await boards.zAdd(leaderboardKeys.skill(skill), { score: rating, value: userId });
  }
}

// recordDailyTime puts a solve of the daily challenge on that day's board, keeping the player's best time.
export async function recordDailyTime({ db, boards }: HandlerDeps, event: AttemptFinished): Promise<void> {
  if (event.status !== "solved") {
    return;
  }
  const [attempt] = await db
    .select({ context: attempts.context, createdAt: attempts.createdAt, durationMs: attempts.durationMs, versionId: attempts.challengeVersionId })
    .from(attempts)
    .where(eq(attempts.id, event.attempt_id));
  if (attempt?.context !== "daily" || attempt.durationMs === null) {
    return;
  }
  const day = utcDay(attempt.createdAt);
  const [daily] = await db
    .select({ track: dailyChallenges.track })
    .from(dailyChallenges)
    .where(and(eq(dailyChallenges.day, day), eq(dailyChallenges.challengeVersionId, attempt.versionId)));
  if (daily) {
    await boards.zAdd(leaderboardKeys.daily(day, daily.track), { score: attempt.durationMs, value: event.user_id }, { comparison: "LT" });
  }
}

export const dailyBoardHandler: FinishedHandler = { group: "worker-daily-board", name: "record daily time", handle: recordDailyTime };
