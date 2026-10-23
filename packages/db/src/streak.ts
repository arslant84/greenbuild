import { localDay, NO_STREAK, visibleStreak } from "@greenbuild/shared";
import { eq } from "drizzle-orm";
import type { Database } from "./client.js";
import { streaks } from "./schema/game.js";

export interface StreakToday {
  current: number;
  longest: number;
  freezes: number;
}

// streakToday is a player's streak as it stands on their calendar day today (task 44), for their profiles
// and their share cards (task 51).
export async function streakToday(db: Pick<Database, "select">, user: { id: string; timezone: string }): Promise<StreakToday> {
  const [row] = await db.select().from(streaks).where(eq(streaks.userId, user.id));
  const state = row ? { current: row.current, longest: row.longest, lastDay: row.lastDay, freezes: row.freezesAvailable } : NO_STREAK;
  return { current: visibleStreak(state, localDay(new Date(), user.timezone)), longest: state.longest, freezes: state.freezes };
}
