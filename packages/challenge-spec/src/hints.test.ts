import { describe, expect, it } from "vitest";
import { parseHints } from "./hints.js";

describe("parseHints", () => {
  it("returns each section's text in order, without the title or headings", () => {
    const markdown = "# Hints\n\n## Hint 1\n\nRead the log.\n\n## Hint 2\n\nCheck `ls -l`.\nThen the owner.\n";
    expect(parseHints(markdown)).toEqual(["Read the log.", "Check `ls -l`.\nThen the owner."]);
  });

  it("finds no hints without hint headings", () => {
    expect(parseHints("# Hints\n\nNothing here.\n")).toEqual([]);
  });
});
