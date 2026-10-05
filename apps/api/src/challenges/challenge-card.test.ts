import { MANIFEST_FIXTURE } from "../testing/manifest-fixture.js";
import { describe, expect, it } from "vitest";
import { challengeCard } from "./challenge-card.js";

const version = { id: "v", version: 1, imageRef: "img", specJson: MANIFEST_FIXTURE };

describe("challengeCard", () => {
  it("shows what the player needs from the nginx-502 manifest", () => {
    expect(challengeCard("nginx-502-upstream", version)).toEqual({
      slug: "nginx-502-upstream",
      version: 1,
      title: "The site returns 502",
      statement: "Users see 502 Bad Gateway. Bring the site back.",
      difficulty: 4,
      skills: ["linux", "nginx"],
      time_limit_sec: 900,
    });
  });

  it("refuses a manifest without a statement", () => {
    expect(() => challengeCard("x", { ...version, specJson: { ...MANIFEST_FIXTURE, statement: undefined } })).toThrow();
  });
});
