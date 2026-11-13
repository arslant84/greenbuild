import { describe, expect, it } from "vitest";
import { incidentId } from "./incident";

describe("incidentId", () => {
  it("names an attempt by the random end of its id, upper case", () => {
    expect(incidentId("019a1d46-1b2c-7d3e-8f40-0123456789ab")).toBe("456789AB");
  });

  it("tells apart two attempts started in the same minute", () => {
    // Two UUIDv7 ids created 10 seconds apart share their first eight characters.
    const first = "019a1d46-1b2c-7d3e-8f40-0123456789ab";
    const second = "019a1d46-3d10-7a01-9b22-fedcba987654";
    expect(incidentId(first)).not.toBe(incidentId(second));
  });
});
