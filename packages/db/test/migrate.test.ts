import { describe, expect, it } from "vitest";
import { applyMigrations } from "../src/migrate.js";
import { attempts, challenges, challengeVersions } from "../src/schema/index.js";
import { useMigratedDatabase } from "./migrated.js";
import { aUser } from "./users-fixture.js";

const TABLES = [
  "assessment_invites",
  "attempt_checks",
  "attempt_signals",
  "attempts",
  "auth_accounts",
  "challenge_versions",
  "challenges",
  "companies",
  "company_invitations",
  "company_members",
  "consents",
  "daily_challenges",
  "outbox",
  "privacy_requests",
  "sandbox_sessions",
  "streaks",
  "subscriptions",
  "user_settings",
  "user_skills",
  "users",
  "xp_ledger",
];

describe("migrations on an empty PostgreSQL 16", () => {
  const db = useMigratedDatabase();

  it("create the tables and can run again", async () => {
    await applyMigrations(db().url);
    const rows = await db().db.execute<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );
    expect(rows.map((row) => row.table_name)).toEqual(TABLES);
  });

  it("fill ids, timestamps and defaults", async () => {
    const [challenge] = await db().db.insert(challenges).values({ slug: "defaults", title: "Defaults", difficulty: 3 }).returning();

    expect(challenge?.id).toMatch(/^[0-9a-f-]{8}-[0-9a-f]{4}-7/);
    expect(challenge?.status).toBe("draft");
    expect(challenge?.visibility).toBe("public");
    expect(challenge?.createdAt).toBeInstanceOf(Date);
  });

  it.each([
    ["difficulty out of range", { slug: "hard", title: "Too hard", difficulty: 11 }],
    ["a private challenge without a company", { slug: "private", title: "Private", difficulty: 3, visibility: "company_private" as const }],
  ])("reject %s", async (_name, values) => {
    await expect(db().db.insert(challenges).values(values)).rejects.toThrow();
  });

  it("reject a seed above 2^53-1 and an eleventh check", async () => {
    const [challenge] = await db().db.insert(challenges).values({ slug: "limits", title: "Limits", difficulty: 3 }).returning();
    const [version] = await db()
      .db.insert(challengeVersions)
      .values({ challengeId: challenge?.id ?? "", version: 1, specJson: {}, imageRef: "img", checkerHash: "sha256:x", source: "human" })
      .returning();
    const attempt = { userId: await aUser(db().db), challengeVersionId: version?.id ?? "", context: "catalog" as const };

    await expect(db().db.insert(attempts).values({ ...attempt, seed: Number.MAX_SAFE_INTEGER + 2 })).rejects.toThrow();
    await expect(db().db.insert(attempts).values({ ...attempt, seed: 1, checksUsed: 11 })).rejects.toThrow();
    await expect(db().db.insert(attempts).values({ ...attempt, seed: Number.MAX_SAFE_INTEGER })).resolves.toBeDefined();
  });
});
