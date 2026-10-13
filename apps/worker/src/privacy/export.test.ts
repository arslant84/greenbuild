import { randomUUID } from "node:crypto";
import {
  applyMigrations,
  assessmentInvites,
  attempts,
  attemptSignals,
  authAccounts,
  challenges,
  challengeVersions,
  cheatReviews,
  companies,
  companyMembers,
  connect,
  consents,
  privacyRequests,
  sql,
  streaks,
  users,
  userSettings,
  userSkills,
  xpLedger,
} from "@greenbuild/db";
import { type Container, startContainer } from "@greenbuild/testkit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EXPORT_FORMAT, exportArchive } from "./export.js";

// architecture.md, "Права пользователя", task 50a: the export holds every section of a player's data.
const NOW = new Date("2026-12-01T12:00:00Z");
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

async function aCompany(name: string): Promise<string> {
  const [company] = await database.db.insert(companies).values({ name, domain: `${randomUUID()}.example.com` }).returning();
  return company?.id ?? "";
}

// idOf answers the id of the row an insert returned.
function idOf(rows: { id: string }[]): string {
  const id = rows[0]?.id;
  if (!id) {
    throw new Error("the insert returned no row");
  }
  return id;
}

// anAssessedAttempt is a solved attempt the player started from Acme's assessment invite.
async function anAssessedAttempt(userId: string): Promise<string> {
  const { db } = database;
  const challengeId = idOf(await db.insert(challenges).values({ slug: `c-${randomUUID()}`, title: "C", difficulty: 3 }).returning());
  const challengeVersionId = idOf(
    await db.insert(challengeVersions).values({ challengeId, version: 2, specJson: {}, imageRef: "img", checkerHash: "sha256:x", source: "human" }).returning(),
  );
  const companyId = await aCompany("Acme");
  const inviteId = idOf(
    await db.insert(assessmentInvites).values({ companyId, challengeVersionId, email: "ada@example.com", tokenHash: randomUUID(), expiresAt: NOW }).returning(),
  );
  const attemptId = idOf(
    await db
      .insert(attempts)
      .values({ userId, challengeVersionId, seed: 1, context: "catalog", status: "solved", flagged: true, assessmentInviteId: inviteId })
      .returning(),
  );
  await db.update(assessmentInvites).set({ attemptId }).where(sql`${assessmentInvites.id} = ${inviteId}`);
  return attemptId;
}

// aPlayerWithEverything has a row in every section the export covers; it answers the user and attempt ids.
async function aPlayerWithEverything(): Promise<{ userId: string; attemptId: string }> {
  const { db } = database;
  const [user] = await db.insert(users).values({ handle: `p-${randomUUID().slice(0, 8)}`, email: `${randomUUID()}@example.com`, displayName: "Ada" }).returning();
  const userId = user?.id ?? "";
  const attemptId = await anAssessedAttempt(userId);
  await db.insert(authAccounts).values({ userId, provider: "github", providerUserId: randomUUID() });
  await db.insert(userSettings).values({ userId, discoveryMode: "open" });
  await db.insert(consents).values({ userId, kind: "discovery", version: "2026-10-11" });
  await db.insert(privacyRequests).values({ userId, kind: "export" });
  await db.insert(attemptSignals).values({ attemptId, signal: "paste_large", value: 1, weight: 3 });
  await db.insert(cheatReviews).values({ attemptId, reviewerId: userId, decision: "clear" });
  await db.insert(xpLedger).values({ userId, attemptId, reason: "solve", amount: 40 });
  await db.insert(streaks).values({ userId, current: 3, longest: 5 });
  await db.insert(userSkills).values({ userId, skill: "linux", rating: 1600 });
  await db.insert(companyMembers).values({ companyId: await aCompany("Initech"), userId, role: "viewer" });
  return { userId, attemptId };
}

describe("exportArchive", () => {
  it("holds every section of the player's data", async () => {
    const { userId, attemptId } = await aPlayerWithEverything();

    const archive = await exportArchive(database.db, userId, NOW);
    expect(archive).toMatchObject({
      format: EXPORT_FORMAT,
      exportedAt: NOW.toISOString(),
      account: { id: userId, displayName: "Ada" },
      signInMethods: [{ provider: "github" }],
      settings: { discoveryMode: "open" },
      consents: [{ kind: "discovery", version: "2026-10-11" }],
      privacyRequests: [{ kind: "export", status: "pending" }],
      attempts: [{ id: attemptId, challengeVersion: 2, status: "solved", reviewDecision: "clear", signals: [{ signal: "paste_large", weight: 3 }] }],
      xp: [{ amount: 40, reason: "solve", attemptId }],
      streak: { current: 3, longest: 5 },
      skills: [{ skill: "linux", rating: 1600 }],
      companies: { assessments: [{ company: "Acme", attemptId }], memberships: [{ company: "Initech", role: "viewer" }] },
    });
  });

  it("leaves out sign-in secrets and other players' data", async () => {
    const { userId } = await aPlayerWithEverything();
    const other = await aPlayerWithEverything();

    const archive = JSON.stringify(await exportArchive(database.db, userId, NOW));
    expect(archive).not.toContain(other.userId);
    expect(archive).not.toContain("providerUserId");
  });
});
