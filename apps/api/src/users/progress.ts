import { type Database, eq, sql, streaks, type users, xpLedger } from "@greenbuild/db";
import { localDay, NO_STREAK, visibleStreak } from "@greenbuild/shared";

type UserRow = typeof users.$inferSelect;

export interface Progress {
  xp: { total: number; today: number };
  streak: { current: number; longest: number; freezes: number };
}

// xpSummary sums the player's XP in total and since midnight in their timezone (task 42b).
async function xpSummary(db: Pick<Database, "select">, user: UserRow): Promise<Progress["xp"]> {
  const startOfToday = sql`(date_trunc('day', now() at time zone ${user.timezone}) at time zone ${user.timezone})`;
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int`,
      today: sql<number>`coalesce(sum(${xpLedger.amount}) filter (where ${xpLedger.createdAt} >= ${startOfToday}), 0)::int`,
    })
    .from(xpLedger)
    .where(eq(xpLedger.userId, user.id));
  return { total: row?.total ?? 0, today: row?.today ?? 0 };
}

// streakToday is the player's streak as it stands on their calendar day today (task 44).
async function streakToday(db: Pick<Database, "select">, user: UserRow): Promise<Progress["streak"]> {
  const [row] = await db.select().from(streaks).where(eq(streaks.userId, user.id));
  const state = row ? { current: row.current, longest: row.longest, lastDay: row.lastDay, freezes: row.freezesAvailable } : NO_STREAK;
  return { current: visibleStreak(state, localDay(new Date(), user.timezone)), longest: state.longest, freezes: state.freezes };
}

// progressOf is a player's XP and streak, for their own profile (/v1/me) and their public one.
export async function progressOf(db: Pick<Database, "select">, user: UserRow): Promise<Progress> {
  return { xp: await xpSummary(db, user), streak: await streakToday(db, user) };
}
