import { applyMigrations, attempts, authAccounts, challenges, challengeVersions, connect, eq, privacyRequests, sql, users, userSettings } from "@greenbuild/db";
import { type Container, startContainer } from "@greenbuild/testkit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { purgeDeletedAccounts } from "./purge.js";

// architecture.md, task 50b: 30 days after deletion no personal data is left; game data stays anonymous.
const NOW = new Date("2026-12-01T12:00:00Z");
const DAY_MS = 86_400_000;
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

// aDeletedAccount is an account deleted daysAgo, with personal data, a sign-in, settings and an attempt.
async function aDeletedAccount(name: string, daysAgo: number): Promise<string> {
  const { db } = database;
  const [user] = await db
    .insert(users)
    .values({ handle: name, displayName: "Ada", email: `${name}@example.com`, country: "KZ", status: "deleted", deletedAt: new Date(NOW.getTime() - daysAgo * DAY_MS) })
    .returning();
  const userId = user?.id ?? "";
  await db.insert(authAccounts).values({ userId, provider: "github", providerUserId: name });
  await db.insert(userSettings).values({ userId });
  await db.insert(privacyRequests).values({ userId, kind: "delete" });
  const [challenge] = await db.insert(challenges).values({ slug: `c-${name}`, title: "C", difficulty: 3 }).returning();
  const [version] = await db.insert(challengeVersions).values({ challengeId: challenge?.id ?? "", version: 1, specJson: {}, imageRef: "img", checkerHash: "sha256:x", source: "human" }).returning();
  await db.insert(attempts).values({ userId, challengeVersionId: version?.id ?? "", seed: 1, context: "catalog", status: "solved" });
  return userId;
}

describe("purgeDeletedAccounts", () => {
  it("deletes personal data after 30 days, keeps anonymous attempts and leaves newer deletions", async () => {
    const due = await aDeletedAccount("due", 31);
    const recent = await aDeletedAccount("recent", 10);

    expect(await purgeDeletedAccounts(database.db, NOW)).toEqual([due]);
    const { db } = database;
    expect((await db.select().from(users).where(eq(users.id, due)))[0]).toMatchObject({ handle: null, displayName: null, email: null, country: null });
    expect(await db.select().from(authAccounts).where(eq(authAccounts.userId, due))).toEqual([]);
    expect(await db.select().from(userSettings).where(eq(userSettings.userId, due))).toEqual([]);
    expect(await db.select().from(attempts).where(eq(attempts.userId, due))).toHaveLength(1);
    expect((await db.select().from(privacyRequests).where(eq(privacyRequests.userId, due)))[0]?.status).toBe("completed");
    expect((await db.select().from(users).where(eq(users.id, recent)))[0]?.handle).toBe("recent");
    expect(await purgeDeletedAccounts(database.db, NOW)).toEqual([]);
  });
});
