import { describe, expect, it } from "vitest";
import { ownProfilePath } from "./own-profile";

describe("ownProfilePath", () => {
  it("opens the player's public profile by their handle", () => {
    expect(ownProfilePath("arslan")).toBe("/u/arslan");
  });

  it("sends a player without a handle to the settings to pick one", () => {
    expect(ownProfilePath(null)).toBe("/settings");
  });
});
