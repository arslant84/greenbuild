import type { AttemptHistoryItem } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { recentRows, solveTime, xpEarned, yesterdaysDaily } from "./history-view";

const NOW = new Date("2026-11-13T10:00:00Z");

function attempt(overrides: Partial<AttemptHistoryItem>): AttemptHistoryItem {
  return {
    id: "01a176fb-0000-4000-8000-000000000000",
    challenge_slug: "nginx-502-upstream",
    challenge_title: "The site returns 502",
    context: "daily",
    status: "solved",
    created_at: "2026-11-13T08:00:00Z",
    finished_at: "2026-11-13T08:10:00Z",
    duration_ms: 255_000,
    hints_used: 0,
    xp_earned: 150,
    ...overrides,
  };
}

describe("recentRows", () => {
  it("shows an attempt as the frame's row: day, incident, outcome, time and XP", () => {
    expect(recentRows([attempt({})], NOW)).toEqual([
      { id: "01a176fb-0000-4000-8000-000000000000", day: "Today", incident: "01A176FB", title: "The site returns 502", slug: "nginx-502-upstream", outcome: "PASSED", time: "04m 15s", xp: "+150 XP" },
    ]);
  });

  it("keeps the last five UTC days, today included, and names yesterday and older days", () => {
    const rows = recentRows(
      [
        attempt({ created_at: "2026-11-12T23:59:00Z", status: "failed", xp_earned: 0 }),
        attempt({ created_at: "2026-11-09T00:00:00Z", status: "abandoned", duration_ms: null, xp_earned: 0 }),
        attempt({ created_at: "2026-11-08T23:59:59Z" }),
      ],
      NOW,
    );
    expect(rows.map((row) => [row.day, row.outcome, row.time, row.xp])).toEqual([
      ["Yesterday", "FAILED", "04m 15s", "—"],
      ["Nov 9", "ABANDONED", "—", "—"],
    ]);
  });
});

describe("yesterdaysDaily", () => {
  it("finds the newest daily attempt of yesterday, not a catalog one", () => {
    const daily = attempt({ id: "b", created_at: "2026-11-12T09:00:00Z" });
    expect(yesterdaysDaily([attempt({ id: "c", context: "catalog", created_at: "2026-11-12T20:00:00Z" }), daily], NOW)).toBe(daily);
  });

  it("is null without an attempt at yesterday's daily", () => {
    expect(yesterdaysDaily([attempt({ created_at: "2026-11-13T08:00:00Z" }), attempt({ created_at: "2026-11-11T08:00:00Z" })], NOW)).toBeNull();
  });
});

describe("solveTime and xpEarned", () => {
  it("show minutes and seconds, and the XP with a plus", () => {
    expect([solveTime(62_400), solveTime(null), xpEarned(30), xpEarned(0)]).toEqual(["01m 02s", "—", "+30 XP", "—"]);
  });
});
