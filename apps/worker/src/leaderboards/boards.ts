import { and, attempts, dailyChallenges, type Database, eq, sql, users, userSkills, xpLedger } from "@greenbuild/db";
import { type AttemptFinished, isoWeek, isoWeekStart, leaderboardKeys, utcDay } from "@greenbuild/shared";
import type { FinishedHandler, HandlerDeps } from "../finished-consumer.js";
import { notVoided } from "../reviews/voided.js";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

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

// recordDailyTime sets, after a solve of the daily challenge, the player's best time on that day's board:
// the fastest of their solves of it that day no review voided; with none left they leave the board.
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
  if (!daily) {
    return;
  }
  const key = leaderboardKeys.daily(day, daily.track);
  const best = await bestDailyTime(db, { userId: event.user_id, versionId: attempt.versionId, day });
  await (best === null ? boards.zRem(key, event.user_id) : boards.zAdd(key, { score: best, value: event.user_id }));
}

async function bestDailyTime(db: Database, { userId, versionId, day }: { userId: string; versionId: string; day: string }): Promise<number | null> {
  const start = new Date(`${day}T00:00:00Z`);
  const end = new Date(start.getTime() + DAY_MS);
  const [row] = await db
    .select({ best: sql<number | null>`min(${attempts.durationMs})` })
    .from(attempts)
    .where(
      and(
        eq(attempts.userId, userId),
        eq(attempts.challengeVersionId, versionId),
        eq(attempts.context, "daily"),
        eq(attempts.status, "solved"),
        sql`${attempts.createdAt} >= ${start.toISOString()}`,
        sql`${attempts.createdAt} < ${end.toISOString()}`,
        notVoided,
      ),
    );
  return row?.best ?? null;
}

export const dailyBoardHandler: FinishedHandler = { group: "worker-daily-board", name: "record daily time", handle: recordDailyTime };
