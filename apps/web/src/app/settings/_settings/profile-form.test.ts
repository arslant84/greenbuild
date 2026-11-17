import { describe, expect, it } from "vitest";
import { countryOptions, isDirty, profileChanges, profileFields, saveError } from "./profile-form";

const loaded = profileFields({ display_name: "Arslan", handle: "arslan", country: "KZ" });

describe("profileFields", () => {
  it("shows a missing name, handle or country as an empty field", () => {
    expect(profileFields({ display_name: null, handle: null, country: null })).toEqual({ display_name: "", handle: "", country: "" });
  });
});

describe("profileChanges", () => {
  it("sends only what changed, trimmed, with the handle lowercase", () => {
    expect(profileChanges(loaded, { ...loaded, display_name: " Arslan B " })).toEqual({ display_name: "Arslan B" });
    expect(profileChanges(loaded, { ...loaded, handle: " Arslan-Dev " })).toEqual({ handle: "arslan-dev" });
  });

  it("sends a new country, and null when the player clears it", () => {
    expect(profileChanges(loaded, { ...loaded, country: "DE" })).toEqual({ country: "DE" });
    expect(profileChanges(loaded, { ...loaded, country: "" })).toEqual({ country: null });
  });

  it("sends nothing when the edits end up as loaded", () => {
    expect(profileChanges(loaded, { ...loaded, display_name: "Arslan ", handle: "ARSLAN" })).toEqual({});
    expect(isDirty(loaded, { ...loaded, display_name: "Arslan ", handle: "ARSLAN" })).toBe(false);
    expect(isDirty(loaded, { ...loaded, display_name: "Arslan B" })).toBe(true);
  });
});

describe("countryOptions", () => {
  it("lists every country by its name", () => {
    const options = countryOptions();
    expect(options).toHaveLength(250);
    expect(options[0]).toEqual({ code: "AF", name: "Afghanistan" });
    expect(options).toContainEqual({ code: "KZ", name: "Kazakhstan" });
  });
});

describe("saveError", () => {
  it("says a taken handle, invalid fields, or anything else", () => {
    expect(saveError({ code: "conflict" })).toBe("That handle is taken. Choose another one.");
    expect(saveError({ code: "validation_failed" })).toContain("3-32 lowercase letters");
    expect(saveError(null)).toBe("Your changes were not saved. Try again.");
  });
});
