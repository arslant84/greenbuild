import { describe, expect, it } from "vitest";
import { uuidv7 } from "./uuid.js";

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidv7", () => {
  it("has the version 7 layout", () => {
    expect(uuidv7()).toMatch(UUID_V7);
  });

  it("starts with the timestamp in milliseconds", () => {
    const at = Date.UTC(2026, 9, 2, 12, 0, 0, 123);
    const id = uuidv7(at);

    expect(Number.parseInt(id.replace(/-/g, "").slice(0, 12), 16)).toBe(at);
  });

  it("sorts by creation time and does not repeat", () => {
    const earlier = uuidv7(Date.UTC(2026, 0, 1));
    const later = uuidv7(Date.UTC(2026, 0, 2));
    const sameMillisecond = new Set(Array.from({ length: 1000 }, () => uuidv7(Date.UTC(2026, 0, 1))));

    expect(earlier < later).toBe(true);
    expect(sameMillisecond.size).toBe(1000);
  });
});
