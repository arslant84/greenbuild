import type { CatalogEntry } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { cardAction, slaLabel, solveTime } from "./card-labels";

const ATTEMPT = "0192a7e2-0000-7000-8000-000000000001";

function entry(progress: Partial<CatalogEntry["progress"]>): CatalogEntry {
  return {
    slug: "nginx-502-upstream",
    version: 1,
    title: "Upstream down",
    statement: "The site answers 502.",
    difficulty: 4,
    skills: ["linux", "nginx"],
    time_limit_sec: 900,
    progress: {
      status: null,
      finished_attempts: 0,
      best_solve_ms: null,
      active_attempt_id: null,
      last_finished_attempt_id: null,
      ...progress,
    },
  };
}

describe("catalog card labels", () => {
  it("shows a solve as minutes and seconds", () => {
    expect(solveTime(222_400)).toBe("03m 42s");
  });

  it("rounds the time limit up to whole minutes", () => {
    expect(slaLabel(900)).toBe("15m SLA");
    expect(slaLabel(270)).toBe("5m SLA");
  });

  it.each([
    ["never attempted", {}, { kind: "start", slug: "nginx-502-upstream" }],
    ["failed", { status: "failed" as const, last_finished_attempt_id: ATTEMPT }, { kind: "retry", slug: "nginx-502-upstream" }],
    ["in progress", { status: "in_progress" as const, active_attempt_id: ATTEMPT }, { kind: "resume", href: `/play/${ATTEMPT}` }],
    ["solved", { status: "solved" as const, last_finished_attempt_id: ATTEMPT }, { kind: "review", href: `/play/${ATTEMPT}/result` }],
  ])("offers the right action when %s", (_name, progress, action) => {
    expect(cardAction(entry(progress))).toEqual(action);
  });
});
