import { applyMigrations, challenges, challengeVersions, companies, connect, dailyChallenges, sql } from "@greenbuild/db";
import { type Container, startContainer } from "@greenbuild/testkit";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { publishDaily } from "./publish.js";
import { publishDue } from "./schedule.js";

// architecture.md, task 41a: one daily challenge per UTC day and track, no repeat within 180 days.
let container: Container;
let database: ReturnType<typeof connect>;

beforeAll(async () => {
  container = await startContainer({
    image: "postgres:16-alpine",
    port: 5432,
    env: { POSTGRES_PASSWORD: "test" },
    ready: async (address) => {
      const probe = connect(`postgres://postgres:test@${address}/postgres`);
      await probe.db.execute(sql`select 1`).finally(() => probe.close());
    },
  });
  const url = `postgres://postgres:test@${container.address}/postgres`;
  await applyMigrations(url);
  database = connect(url);
}, 120_000);

afterAll(async () => {
  await database?.close();
  await container?.stop();
});

beforeEach(async () => {
  await database.db.execute(sql`truncate daily_challenges, challenge_versions, challenges, companies cascade`);
});

// aChallenge adds a challenge with versions 1..versions and returns the newest version's id.
async function aChallenge(slug: string, options: { status?: "live" | "draft"; versions?: number; companyId?: string } = {}): Promise<string> {
  const { status = "live", versions = 1, companyId } = options;
  const visibility = companyId ? ("company_private" as const) : ("public" as const);
  const [challenge] = await database.db.insert(challenges).values({ slug, title: slug, difficulty: 3, status, visibility, companyId }).returning();
  let newest = "";
  for (let version = 1; version <= versions; version++) {
    const [row] = await database.db
      .insert(challengeVersions)
      .values({ challengeId: challenge?.id ?? "", version, specJson: {}, imageRef: "img", checkerHash: "sha256:x", source: "human" })
      .returning();
    newest = row?.id ?? "";
  }
  return newest;
}

describe("publishDaily", () => {
  it("publishes the newest version of a live public challenge, never a draft or a private one", async () => {
    const live = await aChallenge("live", { versions: 2 });
    await aChallenge("draft", { status: "draft" });
    const [company] = await database.db.insert(companies).values({ name: "Acme", domain: "acme.dev" }).returning();
    await aChallenge("private", { companyId: company?.id ?? "" });

    expect(await publishDaily(database.db, "2026-11-01", "linux")).toBe(live);
  });

  it("answers the same challenge when publishing a day again, with one row", async () => {
    await aChallenge("a");
    await aChallenge("b");

    const first = await publishDaily(database.db, "2026-11-01", "linux");
    expect(await publishDaily(database.db, "2026-11-01", "linux")).toBe(first);
    expect(await database.db.select().from(dailyChallenges)).toHaveLength(1);
  });

  it("does not repeat a challenge while another rested one is left, then takes the one used longest ago", async () => {
    const versions = [await aChallenge("a"), await aChallenge("b"), await aChallenge("c")];
    const firstThree = [];
    for (const day of ["2026-11-01", "2026-11-02", "2026-11-03"]) {
      firstThree.push(await publishDaily(database.db, day, "linux"));
    }

    expect(new Set(firstThree)).toEqual(new Set(versions));
    expect(await publishDaily(database.db, "2026-11-04", "linux")).toBe(firstThree[0]);
  });

  it("offers a challenge again once 180 days have passed", async () => {
    const rested = await aChallenge("rested");
    const recent = await aChallenge("recent");
    await database.db.insert(dailyChallenges).values([
      { day: "2026-01-01", track: "linux", challengeVersionId: rested },
      { day: "2026-04-11", track: "linux", challengeVersionId: recent },
    ]);

    expect(await publishDaily(database.db, "2026-06-30", "linux")).toBe(rested);
  });

  it("refuses to publish when no challenge is live", async () => {
    await aChallenge("draft", { status: "draft" });

    await expect(publishDaily(database.db, "2026-11-01", "linux")).rejects.toThrow("no live public challenge");
  });
});

describe("publishDaily and retired versions", () => {
  it("skips a challenge whose newest version was retired (task 49d)", async () => {
    const kept = await aChallenge("kept");
    await aChallenge("leaked", { versions: 2 });
    await database.db.execute(sql`update challenge_versions set retired_reason = 'leak_suspected' where version = 2`);

    expect(await publishDaily(database.db, "2026-11-01", "linux")).toBe(kept);
  });
});

describe("publishDue", () => {
  it("publishes today's and tomorrow's challenge in UTC", async () => {
    await aChallenge("a");
    await aChallenge("b");

    await publishDue(database.db, new Date("2026-11-01T23:30:00Z"));
    const days = await database.db.select({ day: dailyChallenges.day }).from(dailyChallenges).orderBy(dailyChallenges.day);
    expect(days).toEqual([{ day: "2026-11-01" }, { day: "2026-11-02" }]);
  });
});
