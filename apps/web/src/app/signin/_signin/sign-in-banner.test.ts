import { describe, expect, it } from "vitest";
import { AGE_REQUIRED_ERROR } from "../../../server/sign-in-paths";
import { signInBanner } from "./sign-in-banner";

describe("signInBanner", () => {
  it("shows nothing without an error", () => {
    expect(signInBanner(undefined)).toBeNull();
  });

  it("asks for the 16+ confirmation when the rule sent the player back", () => {
    expect(signInBanner(AGE_REQUIRED_ERROR)?.text).toContain("I am 16 or older");
  });

  it("uses the frame's OAuth error for a failed GitHub sign-in", () => {
    expect(signInBanner("OAuthCallbackError")).toEqual({ title: "Authentication Failed:", text: "Couldn't connect to GitHub. Try again or continue using email." });
  });

  it("says a used or expired link must be asked for again", () => {
    expect(signInBanner("Verification")?.text).toContain("Ask for a new one");
  });

  it("falls back to a general failure for any other error", () => {
    expect(signInBanner("Configuration")?.text).toBe("Sign-in did not work. Try again, or continue using email.");
  });
});
