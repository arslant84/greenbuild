import { describe, expect, it } from "vitest";
import { errorCodeFor, httpStatusFor } from "./http-status.js";

describe("http status mapping", () => {
  it.each([
    ["rate_limited", 429],
    ["unavailable", 503],
  ] as const)("answers %s with %d and maps it back", (code, status) => {
    expect(httpStatusFor(code)).toBe(status);
    expect(errorCodeFor(status)).toBe(code);
  });
});
