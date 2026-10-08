import { randomUUID } from "node:crypto";
import { challenges, challengeVersions, connect } from "@greenbuild/db";
import type { ChallengeList } from "@greenbuild/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { type AttemptsApp, player, useAttemptsApp } from "../testing/attempts-app.js";

const PRIVATE_SLUG = "company-private-drill";

async function insertPrivateChallenge(databaseUrl: string): Promise<void> {
  const seeding = connect(databaseUrl);
  const [challenge] = await seeding.db
    .insert(challenges)
    .values({ slug: PRIVATE_SLUG, title: "Private", difficulty: 2, status: "live", visibility: "company_private", companyId: randomUUID() })
    .returning({ id: challenges.id });
  const spec = { title: "Private", statement: "Private.", difficulty: 2, skills: { linux: 1 }, time_limit_sec: 600 };
  await seeding.db.insert(challengeVersions).values({ challengeId: challenge!.id, version: 1, specJson: spec, imageRef: "private:1", checkerHash: "x", source: "company" });
  await seeding.close();
}

async function catalog(app: () => AttemptsApp, query: string): Promise<ChallengeList> {
  const response = await (await player(app, randomUUID())).catalog(query);
  expect(response.status).toBe(200);
  return (await response.json()) as ChallengeList;
}

const slugsOf = (list: ChallengeList) => list.challenges.map((card) => card.slug);

// everyPage follows next_cursor two cards at a time and returns every slug in the order shown.
async function everyPage(app: () => AttemptsApp, query: string): Promise<string[]> {
  let page = await catalog(app, `?limit=2${query}`);
  const slugs = slugsOf(page);
  while (page.next_cursor) {
    page = await catalog(app, `?limit=2${query}&cursor=${page.next_cursor}`);
    slugs.push(...slugsOf(page));
  }
  return slugs;
}

describe("GET /v1/challenges", () => {
  const app = useAttemptsApp();
  beforeAll(() => insertPrivateChallenge(app().env.DATABASE_URL));

  it("lists live public challenges as cards and leaves out private ones", async () => {
    const list = await catalog(app, "?limit=50");
    expect(slugsOf(list)).toContain("nginx-502-upstream");
    expect(slugsOf(list)).not.toContain(PRIVATE_SLUG);
    expect(list.next_cursor).toBeNull();
  });

  it("filters by skill and by difficulty", async () => {
    const postgres = await catalog(app, "?skill=postgresql&limit=50");
    expect(postgres.challenges.length).toBeGreaterThan(0);
    expect(postgres.challenges.every((card) => card.skills.includes("postgresql"))).toBe(true);
    const easy = await catalog(app, "?difficulty_max=3&limit=50");
    expect(easy.challenges.every((card) => card.difficulty <= 3)).toBe(true);
  });

  it("pages through everything once, newest first", async () => {
    expect(await everyPage(app, "")).toEqual(slugsOf(await catalog(app, "?limit=50")));
    expect(await everyPage(app, "&skill=linux")).toEqual(slugsOf(await catalog(app, "?skill=linux&limit=50")));
  });

  it.each([
    ["a limit above the maximum", "?limit=51"],
    ["an unknown difficulty", "?difficulty_min=0"],
    ["a reversed difficulty range", "?difficulty_min=7&difficulty_max=3"],
    ["a malformed cursor", "?cursor=nope"],
  ])("answers %s with 400", async (_name, query) => {
    expect((await (await player(app, randomUUID())).catalog(query)).status).toBe(400);
  });

  it("refuses requests without a token", async () => {
    expect((await fetch(`${app().baseUrl}/v1/challenges`)).status).toBe(401);
  });
});
