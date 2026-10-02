import type { AttemptResult } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { checkSummary, outcomeOf } from "./outcome";

const run = (passed: boolean) => ({ passed, output_tail: "", duration_ms: 90, checked_at: "2026-10-02T10:00:00.000Z" });

describe("outcomeOf", () => {
  it.each([
    ["solved", "SOLVED", "ok"],
    ["failed", "FAILED", "danger"],
    ["expired", "EXPIRED", "warn"],
  ] as const)("shows %s as %s in the %s tone", (status, label, tone) => {
    expect(outcomeOf(status)).toMatchObject({ label, tone });
  });
});

describe("checkSummary", () => {
  it("counts the passing runs", () => {
    const result = { checks: [run(false), run(false), run(true)] } as AttemptResult;

    expect(checkSummary(result)).toBe("1/3 checks passed");
  });

  it("shows an attempt without checks", () => {
    expect(checkSummary({ checks: [] as AttemptResult["checks"] } as AttemptResult)).toBe("0/0 checks passed");
  });
});
