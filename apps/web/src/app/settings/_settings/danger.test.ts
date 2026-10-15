import { describe, expect, it } from "vitest";
import { deleteReady, exportNote } from "./danger";

describe("deleteReady", () => {
  it("needs the box ticked and DELETE typed", () => {
    expect(deleteReady(true, "DELETE")).toBe(true);
    expect(deleteReady(true, " DELETE ")).toBe(true);
    expect(deleteReady(false, "DELETE")).toBe(false);
    expect(deleteReady(true, "delete")).toBe(false);
    expect(deleteReady(true, "")).toBe(false);
  });
});

describe("exportNote", () => {
  it("says how long the export link works", () => {
    expect(exportNote()).toBe("The link usually arrives within a few minutes and works for 7 days.");
  });
});
