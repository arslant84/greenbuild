import { describe, expect, it } from "vitest";
import { avatarColor, boardApiPath, formatScore, initials, rankLabel, rankStyle, readBoardParams, resetsIn, weekLabel } from "./board-view";

describe("readBoardParams", () => {
  it("defaults to the weekly board and the linux skill, and ignores unknown values", () => {
    expect(readBoardParams({})).toEqual({ tab: "weekly", skill: "linux" });
    expect(readBoardParams({ tab: "friends", skill: "Bad Skill" })).toEqual({ tab: "weekly", skill: "linux" });
    expect(readBoardParams({ tab: "skill", skill: "nginx" })).toEqual({ tab: "skill", skill: "nginx" });
  });
});

describe("boardApiPath", () => {
  it("asks the API for each tab's board", () => {
    expect(boardApiPath({ tab: "weekly", skill: "linux" }, "KZ", 12)).toBe("/v1/leaderboards/weekly?limit=12");
    expect(boardApiPath({ tab: "country", skill: "linux" }, "KZ", 12)).toBe("/v1/leaderboards/weekly?limit=12&country=KZ");
    expect(boardApiPath({ tab: "skill", skill: "nginx" }, null, 12)).toBe("/v1/leaderboards/skill?limit=12&skill=nginx");
    expect(boardApiPath({ tab: "daily", skill: "linux" }, null, 12)).toBe("/v1/leaderboards/daily?limit=12");
  });

  it("has no country board for a player without a country", () => {
    expect(boardApiPath({ tab: "country", skill: "linux" }, null, 12)).toBeNull();
  });
});

describe("rows", () => {
  it("styles the podium as the frame does", () => {
    expect([1, 2, 3, 4].map(rankStyle)).toEqual([
      { color: "#ffc640", bold: true },
      { color: "#e5e2e3", bold: true },
      { color: "#cd7f32", bold: true },
      { color: "#859397", bold: false },
    ]);
    expect(rankLabel(7)).toBe("#07");
    expect(rankLabel(147)).toBe("#147");
  });

  it("makes initials from a handle, or a dash for a hidden player", () => {
    expect(initials("k8s_alchemist")).toBe("KA");
    expect(initials("arslan")).toBe("AR");
    expect(initials(null)).toBe("—");
  });

  it("formats XP, ratings and solve times", () => {
    expect(formatScore("weekly", 2840)).toBe("2,840 XP");
    expect(formatScore("skill", 1612.5)).toBe("1,613");
    expect(formatScore("daily", 434_000)).toBe("07:14");
  });
});

describe("avatarColor", () => {
  it("colors the first two players as the frame does", () => {
    expect([1, 2, 3].map(avatarColor)).toEqual(["#ffc640", "#8aebff", "#e5e2e3"]);
  });
});

describe("the week", () => {
  it("names the ISO week and the time until it resets on Monday 00:00 UTC", () => {
    const now = new Date("2026-10-14T09:38:00Z");
    expect(weekLabel(now)).toBe("WEEK 42");
    expect(resetsIn(now)).toBe("4D 14H 22M");
  });
});
