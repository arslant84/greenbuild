import { isoWeek, type LeaderboardResponse } from "@greenbuild/shared";

type Entry = LeaderboardResponse["entries"][number];

const TOP_PLAYERS = 5;

// The weekly XP board's first five (task 45b), for the Daily screen's Top 5 This Week.
export const TOP_FIVE_PATH = `/v1/leaderboards/weekly?limit=${TOP_PLAYERS}`;

// weekLabel is the ISO week the weekly board counts, as the frame shows it: "WK 46".
export function weekLabel(now: Date): string {
  const week = isoWeek(now);
  return `WK ${Number(week.slice(week.indexOf("-") + 1))}`;
}

// topFiveName: a player without a public handle stays hidden, as on the leaderboard screen.
export function topFiveName(entry: Entry): string {
  return entry.handle ? `@${entry.handle}` : "Hidden player";
}
