import { describe, expect, it } from "vitest";
import { sandboxView } from "./sandbox-view";
import { firstLine } from "./states/first-line";
import type { CheckState } from "./use-check";

const idle: CheckState = { kind: "idle" };
const checking: CheckState = { kind: "checking" };
const failed: CheckState = { kind: "done", result: { passed: false, output_tail: "the site does not answer with 200\n", duration_ms: 90, checks_left: 9 } };
const passed: CheckState = { kind: "done", result: { passed: true, output_tail: "the site is back\n", duration_ms: 90, checks_left: 8 } };

describe("sandboxView", () => {
  it.each([
    { name: "connected and idle", status: "connected", check: idle, used: 0, expected: { frame: "V1", mode: "ready" } },
    { name: "still connecting", status: "connecting", check: idle, used: 0, expected: { frame: "V1", mode: "exhausted" } },
    { name: "checking", status: "connected", check: checking, used: 1, expected: { frame: "V2", mode: "checking" } },
    { name: "after a failed check", status: "connected", check: failed, used: 1, expected: { frame: "V4", mode: "ready" } },
    { name: "after a passed check", status: "connected", check: passed, used: 2, expected: { frame: "V3", mode: "exhausted" } },
    { name: "disconnected", status: "disconnected", check: failed, used: 1, expected: { frame: "V5", mode: "reconnecting" } },
    { name: "solved, then disconnected", status: "disconnected", check: passed, used: 2, expected: { frame: "V3", mode: "exhausted" } },
    { name: "out of checks", status: "connected", check: failed, used: 10, expected: { frame: "V4", mode: "exhausted" } },
  ] as const)("$name", ({ status, check, used, expected }) => {
    expect(sandboxView(status, check, used)).toMatchObject(expected);
  });

  it("treats a 429 from the check as out of checks", () => {
    expect(sandboxView("connected", { kind: "error", status: 429 }, 9).mode).toBe("exhausted");
  });

  it("counts the checks left", () => {
    expect(sandboxView("connected", idle, 3).checksLeft).toBe(7);
  });
});

describe("firstLine", () => {
  it.each([
    ["\n\n  the site does not answer with 200\nmore", "the site does not answer with 200"],
    ["", ""],
  ])("finds the first line of %j", (output, line) => {
    expect(firstLine(output)).toBe(line);
  });
});

describe("checks left right after a check", () => {
  it("trusts the check's own count while the attempt has not been read again", () => {
    const justFailed: CheckState = { kind: "done", result: { passed: false, output_tail: "", duration_ms: 90, checks_left: 9 } };

    expect(sandboxView("connected", justFailed, 0).checksLeft).toBe(9);
  });
});
