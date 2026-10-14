import type { PublicProfile } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { levelRing, profileDescription, profileInitials, profileName, profileTitle, SKILLS_SHOWN, skillRows } from "./profile-view";

const skill = (name: string, rating: number) => ({ skill: name, rating, interval: [rating - 90, rating + 90] as [number, number], attempts: 3 });

const arslan: PublicProfile = {
  handle: "arslan",
  display_name: "Arslan Berdiyev",
  level: 2,
  xp: 400,
  solved: 1,
  streak: { current: 1, longest: 4 },
  skills: [{ skill: "linux", rating: 1940, interval: [1850, 2030], attempts: 1 }],
};

describe("profile identity", () => {
  it("names the player by display name, or by handle without one", () => {
    expect(profileName(arslan)).toBe("Arslan Berdiyev");
    expect(profileName({ ...arslan, display_name: null })).toBe("@arslan");
  });

  it("makes initials from the display name's first two words, or from the handle", () => {
    expect(profileInitials(arslan)).toBe("AB");
    expect(profileInitials({ ...arslan, display_name: "Cher" })).toBe("CH");
    expect(profileInitials({ ...arslan, display_name: null })).toBe("AR");
  });
});

describe("levelRing", () => {
  it("fills the ring by the progress to the next level", () => {
    // Level 2 starts at 283 XP and level 3 at 520: 400 XP is 49.4% of the way.
    const ring = levelRing(arslan);
    expect(ring.toNext).toBe("49.4% to L3");
    expect(ring.dashOffset).toBeCloseTo(2 * Math.PI * 20 * (1 - 117 / 237));
  });
});

describe("skillRows", () => {
  it("shows a skill's rating, its 95% interval and where both lie on the 1,000–2,200 track", () => {
    const [row] = skillRows(arslan, false);
    expect(row).toMatchObject({ position: "01", name: "Linux", rating: "1,940", spread: "±90", interval: "[1,850 – 2,030]", attempts: "1 attempt" });
    expect(row?.point).toBeCloseTo(78.33, 1);
    expect(row?.band.left).toBeCloseTo(70.83, 1);
    expect(row?.band.width).toBeCloseTo(15, 1);
  });

  it("keeps ratings outside the track at its ends", () => {
    const [low, high] = skillRows({ ...arslan, skills: [skill("redis", 900), skill("tls", 2400)] }, false);
    expect(low?.point).toBe(0);
    expect(high?.point).toBe(100);
  });

  it("lists the first five skills until the list is expanded", () => {
    const many = { ...arslan, skills: ["a", "b", "c", "d", "e", "f", "g"].map((name, index) => skill(name, 1800 - index)) };
    expect(skillRows(many, false)).toHaveLength(SKILLS_SHOWN);
    expect(skillRows(many, true).map((row) => row.position)).toEqual(["01", "02", "03", "04", "05", "06", "07"]);
  });
});

describe("page metadata", () => {
  it("titles the page with the player's name and handle", () => {
    expect(profileTitle(arslan)).toBe("Arslan Berdiyev (@arslan) · greenbuild");
  });

  it("describes the player with real data only", () => {
    expect(profileDescription(arslan)).toBe("@arslan on greenbuild: level 2, 1 incident solved in live sandboxes. Strongest skill: Linux, rated 1,940.");
    expect(profileDescription({ ...arslan, solved: 0, skills: [] })).toBe("@arslan on greenbuild: level 2, 0 incidents solved in live sandboxes.");
  });
});
