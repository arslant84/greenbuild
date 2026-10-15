import { describe, expect, it } from "vitest";
import { discoveryError, discoveryRequest, isFindable, statusLabel } from "./discovery";

describe("isFindable", () => {
  it("counts open and passive as findable, hidden as not", () => {
    expect(isFindable({ mode: "open" })).toBe(true);
    expect(isFindable({ mode: "passive" })).toBe(true);
    expect(isFindable({ mode: "hidden" })).toBe(false);
  });
});

describe("discoveryRequest", () => {
  it("opens with the 18+ confirmation only when ticked, and hides without it", () => {
    expect(discoveryRequest(true, true)).toEqual({ mode: "open", confirm_18: true });
    expect(discoveryRequest(true, false)).toEqual({ mode: "open" });
    expect(discoveryRequest(false, true)).toEqual({ mode: "hidden" });
  });
});

describe("statusLabel and discoveryError", () => {
  it("names the state and says why a change failed", () => {
    expect(statusLabel(false)).toBe("CURRENT STATUS: INVISIBLE TO RECRUITERS");
    expect(statusLabel(true)).toBe("ACTIVE: VISIBLE TO VERIFIED COMPANIES");
    expect(discoveryError({ code: "unprocessable" })).toBe("Confirm you are 18 or older to be found by companies.");
    expect(discoveryError(null)).toBe("Your choice was not saved. Try again.");
  });
});
