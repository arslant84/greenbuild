import { isoWeek, isoWeekStart, type LeaderboardKind } from "@greenbuild/shared";

// The leaderboard screen's logic (Figma "Global Engineering Standings & Leaderboards", 3:3639; task 45b).

// The tabs with data; the frame's Friends tab has none (lb:friends is not stored) and stays disabled.
export const BOARD_TABS = ["weekly", "country", "skill", "daily"] as const;
export type BoardTab = (typeof BOARD_TABS)[number];

const DEFAULT_SKILL = "linux";
const SKILL = /^[a-z0-9-]{1,32}$/;
const WEEK_MS = 7 * 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const SECOND_MS = 1_000;

export interface BoardParams {
  tab: BoardTab;
  skill: string;
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function readBoardParams(search: SearchParams): BoardParams {
  const tab = first(search.tab);
  const skill = first(search.skill);
  return {
    tab: BOARD_TABS.find((known) => known === tab) ?? "weekly",
    skill: skill && SKILL.test(skill) ? skill : DEFAULT_SKILL,
  };
}

// boardApiPath is the API request for a tab, or null for the country tab of a player without a country.
export function boardApiPath({ tab, skill }: BoardParams, country: string | null, limit: number): string | null {
  const kind: LeaderboardKind = tab === "country" ? "weekly" : tab;
  const query = new URLSearchParams({ limit: String(limit) });
  if (tab === "country") {
    if (!country) {
      return null;
    }
    query.set("country", country);
  }
  if (tab === "skill") {
    query.set("skill", skill);
  }
  return `/v1/leaderboards/${kind}?${query.toString()}`;
}

export function boardHref(tab: BoardTab): string {
  return tab === "weekly" ? "/leaderboard" : `/leaderboard?tab=${tab}`;
}

const PODIUM: Record<number, string> = { 1: "#ffc640", 2: "#e5e2e3", 3: "#cd7f32" };

// rankStyle follows the frame: the first three bold in gold, light and bronze, the rest regular grey.
export function rankStyle(rank: number): { color: string; bold: boolean } {
  const podium = PODIUM[rank];
  return podium ? { color: podium, bold: true } : { color: "#859397", bold: false };
}

export function rankLabel(rank: number): string {
  return `#${String(rank).padStart(2, "0")}`;
}

// initials are the first letters of a handle's first two parts (k8s_alchemist → KA), or its first two letters.
export function initials(handle: string | null): string {
  if (!handle) {
    return "—";
  }
  const parts = handle.split(/[_-]/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}` : handle.slice(0, 2);
  return letters.toUpperCase();
}

// formatScore shows a board's score: weekly XP, a skill rating, or a daily solve time (mm:ss).
export function formatScore(tab: BoardTab, score: number): string {
  if (tab === "skill") {
    return Math.round(score).toLocaleString("en-US");
  }
  if (tab === "daily") {
    const seconds = Math.round(score / SECOND_MS);
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  return `${Math.round(score).toLocaleString("en-US")} XP`;
}

export const SCORE_HEADER: Record<BoardTab, string> = { weekly: "METRICS (XP)", country: "METRICS (XP)", skill: "RATING", daily: "SOLVE TIME" };

// weekLabel is the ISO week the weekly boards count (Monday 00:00 UTC to the next).
export function weekLabel(now: Date): string {
  return `WEEK ${Number(isoWeek(now).slice(-2))}`;
}

// resetsIn is the time until the weekly boards start again, as the frame writes it (2D 14H 22M).
export function resetsIn(now: Date): string {
  const left = isoWeekStart(now).getTime() + WEEK_MS - now.getTime();
  const days = Math.floor(left / (24 * HOUR_MS));
  const hours = Math.floor((left % (24 * HOUR_MS)) / HOUR_MS);
  const minutes = Math.floor((left % HOUR_MS) / MINUTE_MS);
  return `${days}D ${hours}H ${minutes}M`;
}

// avatarColor is the initials' color in the frame: gold for the first, accent for the second, then light.
export function avatarColor(rank: number): string {
  return rank === 1 ? "#ffc640" : rank === 2 ? "#8aebff" : "#e5e2e3";
}
