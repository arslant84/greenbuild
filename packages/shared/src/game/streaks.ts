// architecture.md, "Стрики" (task 44): a day is the player's calendar day in their timezone; any solve
// that day extends the streak; a freeze is earned for every 7 streak days (at most 3 in stock) and
// spent automatically on a missed day.
export const STREAK_DAYS_PER_FREEZE = 7;
export const STREAK_MAX_FREEZES = 3;

const DAY_MS = 86_400_000;

export interface StreakState {
  current: number;
  longest: number;
  // YYYY-MM-DD of the last day that counted, or null before the first solve.
  lastDay: string | null;
  freezes: number;
}

export const NO_STREAK: StreakState = { current: 0, longest: 0, lastDay: null, freezes: 0 };

// localDay is the YYYY-MM-DD of a moment in an IANA timezone.
export function localDay(moment: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(moment);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

// applySolve counts a solve on day. The same day again, or an earlier one arriving late, changes
// nothing. Missed days are covered by freezes when there are enough of them; otherwise the streak
// starts over at 1 and the freezes stay in stock.
export function applySolve(state: StreakState, day: string): StreakState {
  const gap = state.lastDay === null ? 1 : daysBetween(state.lastDay, day);
  if (gap <= 0) {
    return state;
  }
  const missed = gap - 1;
  const continues = state.lastDay !== null && missed <= state.freezes;
  const current = continues ? state.current + 1 : 1;
  const left = continues ? state.freezes - missed : state.freezes;
  const earned = current % STREAK_DAYS_PER_FREEZE === 0 ? 1 : 0;
  return { current, longest: Math.max(state.longest, current), lastDay: day, freezes: Math.min(STREAK_MAX_FREEZES, left + earned) };
}

// visibleStreak is the streak to show on today: still alive while the days missed since the last solve
// can be covered by freezes, otherwise 0.
export function visibleStreak(state: StreakState, today: string): number {
  if (state.lastDay === null) {
    return 0;
  }
  return daysBetween(state.lastDay, today) - 1 <= state.freezes ? state.current : 0;
}
