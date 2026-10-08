import { describe, expect, it } from "vitest";
import { apiQuery, catalogHref, NO_FILTERS, readCatalogParams, toggled } from "./catalog-params";

describe("catalog filters in the URL", () => {
  it("keeps what the API accepts and drops the rest", () => {
    const params = readCatalogParams({
      skill: ["linux", "Bad Skill", "linux"],
      sla: ["lt5", "20to30"],
      status: "lost",
      tier: "4-6",
      q: "  nginx  ",
    });
    expect(params).toEqual({
      skill: ["linux"],
      sla: ["lt5"],
      status: null,
      tier: "4-6",
      q: "nginx",
    });
  });

  it("turns a severity tier into a difficulty range for the API", () => {
    expect(apiQuery({ ...NO_FILTERS, skill: ["linux", "nginx"], tier: "7-10" }, "0192")).toBe("?skill=linux&skill=nginx&difficulty_min=7&difficulty_max=10&cursor=0192");
  });

  it("links to the bare catalog when nothing is filtered", () => {
    expect(catalogHref(NO_FILTERS)).toBe("/challenges");
    expect(apiQuery(NO_FILTERS)).toBe("");
  });

  it("adds a skill once and removes it on the second toggle", () => {
    const once = toggled(NO_FILTERS, "skill", "linux");
    expect(catalogHref(once)).toBe("/challenges?skill=linux");
    expect(toggled(once, "skill", "linux").skill).toEqual([]);
  });
});
