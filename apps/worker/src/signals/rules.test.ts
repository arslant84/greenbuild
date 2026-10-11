import { describe, expect, it } from "vitest";
import { type AttemptFacts, findSignals, isFlagged, type LogEvent, parseLog, readsSomething, SIGNAL_WEIGHTS } from "./rules.js";

// architecture.md, task 49b: each signal on fixture session logs.
const START = new Date("2026-11-01T10:00:00Z");
const MINUTE_MS = 60_000;

// at is an event the given number of minutes after the sandbox became ready.
function at(minutes: number, type: string, data?: string): LogEvent {
  return { t: new Date(START.getTime() + minutes * MINUTE_MS).toISOString(), type, ...(data === undefined ? {} : { data }) };
}

// facts is a solve in ten minutes with one check, no median and no rating gap, unless overridden.
function facts(overrides: Partial<AttemptFacts> = {}): AttemptFacts {
  return { solved: true, checksUsed: 1, startedAt: START, finishedAt: new Date(START.getTime() + 10 * MINUTE_MS), durationMs: 10 * MINUTE_MS, medianSolveMs: null, ratingGap: null, ...overrides };
}

// explored is a log of a player who looked around and typed throughout.
const explored = [at(1, "input", "cat /etc/nginx/conf.d/site.conf\r"), at(1, "command", "cat /etc/nginx/conf.d/site.conf"), at(5, "input", "x"), at(9, "input", "nginx -s reload\r")];

function names(events: LogEvent[] | null, attempt: AttemptFacts): string[] {
  return findSignals(events, attempt).map((found) => found.signal);
}

describe("parseLog", () => {
  it("reads JSONL events and skips a torn last line", () => {
    expect(parseLog('{"t":"2026-11-01T10:00:00Z","type":"start"}\n{"t":"2026-11-01T10:01:00Z","type":"inp')).toEqual([{ t: "2026-11-01T10:00:00Z", type: "start" }]);
  });
});

describe("findSignals", () => {
  it("finds nothing for a player who explored and typed throughout", () => {
    expect(names(explored, facts())).toEqual([]);
  });

  it("paste_large: a single input over 200 characters", () => {
    expect(findSignals([...explored, at(2, "input", "x".repeat(250))], facts())).toContainEqual({ signal: "paste_large", value: 250, weight: SIGNAL_WEIGHTS.paste_large });
    expect(names([...explored, at(2, "input", "x".repeat(150))], facts())).toEqual([]);
  });

  it("idle_then_solve: no input for over 70% of the time, then a first-check solve", () => {
    const late = [at(8, "input", "cat x\r"), at(8, "command", "cat x")];

    expect(names(late, facts())).toEqual(["idle_then_solve"]);
    expect(names(late, facts({ checksUsed: 2 }))).toEqual([]);
  });

  it("no_exploration: a solve without a single read command", () => {
    const blind = [at(1, "input", "sed -i s/a/b/ f\r"), at(1, "command", "sed -i s/a/b/ f"), at(5, "input", "x"), at(9, "input", "y")];

    expect(names(blind, facts())).toEqual(["no_exploration"]);
    expect(names(blind, facts({ solved: false }))).toEqual([]);
  });

  it("instant_solve: under 20% of the challenge's median time", () => {
    expect(names(explored, facts({ durationMs: 10_000, medianSolveMs: 100_000 }))).toEqual(["instant_solve"]);
    expect(names(explored, facts({ durationMs: 30_000, medianSolveMs: 100_000 }))).toEqual([]);
  });

  it("rating_jump: a solve 400 or more points above the player's rating", () => {
    expect(names(explored, facts({ ratingGap: 450 }))).toEqual(["rating_jump"]);
    expect(names(explored, facts({ ratingGap: 300 }))).toEqual([]);
  });

  it("reads only the database signals when the log is missing", () => {
    expect(names(null, facts({ ratingGap: 500 }))).toEqual(["rating_jump"]);
  });
});

describe("readsSomething", () => {
  it.each([
    ["sudo cat /etc/hosts", true],
    ["journalctl -u nginx | tail -n 20", true],
    ["LANG=C ls -la /srv", true],
    ["/usr/bin/grep -r PORT /srv", true],
    ["sed -i 's/a/b/' f && nginx -s reload", true],
    ["sed -i 's/a/b/' f; chmod 644 f", false],
  ])("%s → %s", (command, reads) => {
    expect(readsSomething(command)).toBe(reads);
  });
});

describe("isFlagged", () => {
  it("flags when the weights add up to more than 4", () => {
    const of = (...signals: (keyof typeof SIGNAL_WEIGHTS)[]) => signals.map((signal) => ({ signal, value: 1, weight: SIGNAL_WEIGHTS[signal] }));

    expect(isFlagged(of("no_exploration", "paste_large"))).toBe(true);
    expect(isFlagged(of("idle_then_solve"))).toBe(false);
    expect(isFlagged(of("paste_large", "instant_solve"))).toBe(false);
  });
});
