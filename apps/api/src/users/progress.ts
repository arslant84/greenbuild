import { type Database, eq, sql, streakToday, type users, xpLedger } from "@greenbuild/db";

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

// progressOf is a player's XP and streak, for their own profile (/v1/me) and their public one.
export async function progressOf(db: Pick<Database, "select">, user: UserRow): Promise<Progress> {
  return { xp: await xpSummary(db, user), streak: await streakToday(db, user) };
}
