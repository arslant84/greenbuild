import { randomUUID } from "node:crypto";
import { challenges, challengeVersions, companies, connect } from "@greenbuild/db";
import { CATALOG_PAGE_MAX, type CatalogEntry, type ChallengeList } from "@greenbuild/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { type AttemptsApp, player, useAttemptsApp } from "../testing/attempts-app.js";

const PRIVATE_SLUG = "company-private-drill";

async function insertPrivateChallenge(databaseUrl: string): Promise<void> {
  const seeding = connect(databaseUrl);
  const [company] = await seeding.db.insert(companies).values({ name: "Acme", domain: "acme.dev" }).returning();
  const [challenge] = await seeding.db
    .insert(challenges)
    .values({ slug: PRIVATE_SLUG, title: "Private", difficulty: 2, status: "live", visibility: "company_private", companyId: company?.id ?? "" })
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

const slugsOf = (cards: CatalogEntry[]) => cards.map((card) => card.slug);

// everyCard follows next_cursor `limit` cards at a time and returns every card in the order shown.
async function everyCard(app: () => AttemptsApp, query: string, limit: number): Promise<CatalogEntry[]> {
  let page = await catalog(app, `?limit=${limit}${query}`);
  const cards = [...page.challenges];
  while (page.next_cursor) {
    page = await catalog(app, `?limit=${limit}${query}&cursor=${page.next_cursor}`);
    cards.push(...page.challenges);
  }
  return cards;
}

async function listsPublicOnly(app: () => AttemptsApp): Promise<void> {
  const list = await catalog(app, `?limit=${CATALOG_PAGE_MAX}`);
  const cards = await everyCard(app, "", CATALOG_PAGE_MAX);
  expect(slugsOf(cards)).toContain("nginx-502-upstream");
  expect(slugsOf(cards)).not.toContain(PRIVATE_SLUG);
  expect(list.total).toBe(cards.length);
  expect(list.catalog.challenges).toBe(list.total);
  expect(list.catalog.skills.linux).toBe(cards.filter((card) => card.skills.includes("linux")).length);
  expect(Object.values(list.catalog.sla).reduce((sum, count) => sum + count, 0)).toBe(list.total);
}

async function filters(app: () => AttemptsApp): Promise<void> {
  const either = await catalog(app, "?skill=postgresql&skill=redis&limit=50");
  expect(either.challenges.length).toBeGreaterThan(0);
  expect(either.challenges.every((card) => card.skills.some((skill) => ["postgresql", "redis"].includes(skill)))).toBe(true);
  expect((await catalog(app, "?difficulty_max=3&limit=50")).challenges.every((card) => card.difficulty <= 3)).toBe(true);
  const window = await catalog(app, "?sla=10to15&limit=50");
  expect(window.challenges.every((card) => card.time_limit_sec > 600 && card.time_limit_sec <= 900)).toBe(true);
  const search = await catalog(app, "?q=POSTGRESQL&limit=50");
  expect(slugsOf(search.challenges)).toContain("postgres-data-permissions");
  expect(search.total).toBe(search.challenges.length);
  expect((await catalog(app, "?q=%25")).total).toBe(0);
}

describe("GET /v1/challenges", () => {
  const app = useAttemptsApp();
  beforeAll(() => insertPrivateChallenge(app().env.DATABASE_URL));

  it("lists live public challenges as cards, counts them, and leaves out private ones", () => listsPublicOnly(app));
  it("filters by any of several skills, difficulty, time limit and text", () => filters(app));

  it("pages through everything once, newest first", async () => {
    expect(slugsOf(await everyCard(app, "", 2))).toEqual(slugsOf(await everyCard(app, "", CATALOG_PAGE_MAX)));
    expect(slugsOf(await everyCard(app, "&skill=linux", 2))).toEqual(slugsOf(await everyCard(app, "&skill=linux", CATALOG_PAGE_MAX)));
  });

  it.each([
    ["a limit above the maximum", "?limit=51"],
    ["an unknown difficulty", "?difficulty_min=0"],
    ["a reversed difficulty range", "?difficulty_min=7&difficulty_max=3"],
    ["an unknown SLA window", "?sla=20to30"],
    ["an unknown status", "?status=lost"],
    ["a malformed cursor", "?cursor=nope"],
  ])("answers %s with 400", async (_name, query) => {
    expect((await (await player(app, randomUUID())).catalog(query)).status).toBe(400);
  });

  it("refuses requests without a token", async () => {
    expect((await fetch(`${app().baseUrl}/v1/challenges`)).status).toBe(401);
  });
});
