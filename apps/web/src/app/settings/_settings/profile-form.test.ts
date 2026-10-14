import { describe, expect, it } from "vitest";
import { isDirty, profileChanges, profileFields, saveError } from "./profile-form";

const loaded = profileFields({ display_name: "Arslan", handle: "arslan" });

describe("profileFields", () => {
  it("shows a missing name or handle as an empty field", () => {
    expect(profileFields({ display_name: null, handle: null })).toEqual({ display_name: "", handle: "" });
  });
});

describe("profileChanges", () => {
  it("sends only what changed, trimmed, with the handle lowercase", () => {
    expect(profileChanges(loaded, { display_name: " Arslan B ", handle: "arslan" })).toEqual({ display_name: "Arslan B" });
    expect(profileChanges(loaded, { display_name: "Arslan", handle: " Arslan-Dev " })).toEqual({ handle: "arslan-dev" });
  });

  it("sends nothing when the edits end up as loaded", () => {
    expect(profileChanges(loaded, { display_name: "Arslan ", handle: "ARSLAN" })).toEqual({});
    expect(isDirty(loaded, { display_name: "Arslan ", handle: "ARSLAN" })).toBe(false);
    expect(isDirty(loaded, { display_name: "Arslan B", handle: "arslan" })).toBe(true);
  });
});

describe("saveError", () => {
  it("says a taken handle, invalid fields, or anything else", () => {
    expect(saveError({ code: "conflict" })).toBe("That handle is taken. Choose another one.");
    expect(saveError({ code: "validation_failed" })).toContain("3-32 lowercase letters");
    expect(saveError(null)).toBe("Your changes were not saved. Try again.");
  });
});
