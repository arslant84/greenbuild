import type { AttemptHistoryItem } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { FULL_HISTORY_PATH, historyMode, historyTableRows, historyTotals, startedAt } from "./history-table";

function attempt(overrides: Partial<AttemptHistoryItem>): AttemptHistoryItem {
  return {
    id: "019a1d46-1b2c-7d3e-8f40-0123456789ab",
    challenge_slug: "nginx-502-upstream",
    challenge_title: "The site returns 502",
    context: "daily",
    status: "solved",
    created_at: "2026-11-12T09:14:30Z",
    finished_at: "2026-11-12T09:20:00Z",
    duration_ms: 255_000,
    hints_used: 1,
    xp_earned: 150,
    ...overrides,
  };
}

describe("historyTableRows", () => {
  it("shows an attempt as the frame's row: date, incident, mode, outcome, time, hints and XP", () => {
    expect(historyTableRows([attempt({})], "all")).toEqual([
      {
        id: "019a1d46-1b2c-7d3e-8f40-0123456789ab",
        day: "Nov 12, 09:14 UTC",
        incident: "456789AB",
        title: "The site returns 502",
        slug: "nginx-502-upstream",
        outcome: "PASSED",
        time: "04m 15s",
        xp: "+150 XP",
        mode: "DAILY",
        hints: "1",
      },
    ]);
  });

  it("keeps only the chosen mode's attempts", () => {
    const attempts = [attempt({ id: "a", context: "daily" }), attempt({ id: "b", context: "catalog" }), attempt({ id: "c", context: "duel" })];
    expect(historyTableRows(attempts, "catalog").map((row) => row.id)).toEqual(["b"]);
    expect(historyTableRows(attempts, "all").map((row) => row.id)).toEqual(["a", "b", "c"]);
  });
});

describe("historyMode", () => {
  it("reads daily or catalog from the query and falls back to all", () => {
    expect([historyMode("daily"), historyMode("catalog"), historyMode("duel"), historyMode(undefined), historyMode(["daily"])]).toEqual(["daily", "catalog", "all", "all", "all"]);
  });
});

describe("historyTotals", () => {
  it("counts the attempts, the solved ones and their XP", () => {
    const attempts = [attempt({}), attempt({ status: "failed", xp_earned: 0 }), attempt({ status: "solved", xp_earned: 30 })];
    expect(historyTotals(attempts)).toEqual({ attempts: 3, solved: 2, xp: 180 });
  });
});

describe("startedAt", () => {
  it("shows midnight UTC as 00, not 24", () => {
    expect(startedAt("2026-11-06T00:00:00Z")).toBe("Nov 06, 00:00 UTC");
  });
});

describe("FULL_HISTORY_PATH", () => {
  it("asks for as many attempts as the API answers", () => {
    expect(FULL_HISTORY_PATH).toBe("/v1/me/attempts?limit=50");
  });
});
