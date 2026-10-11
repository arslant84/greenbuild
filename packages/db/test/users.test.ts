import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, type Database } from "../src/client.js";
import { applyMigrations, MIGRATIONS_FOLDER } from "../src/migrate.js";
import { attempts, authAccounts, challenges, challengeVersions, users } from "../src/schema/index.js";
import { uuidv7 } from "../src/uuid.js";
import { useMigratedDatabase } from "./migrated.js";
import { startPostgres, type TestDatabase } from "./postgres.js";

const STARTUP_TIMEOUT_MS = 120_000;
// Applies every migration twice; beyond vitest's 5 s default while other suites start containers.
const MIGRATION_TEST_TIMEOUT_MS = 60_000;
// Migrations before 0005_users, i.e. a database as it was before tasks 29a and 29b.
const MIGRATIONS_BEFORE_USERS = 5;

interface Journal {
  entries: { idx: number }[];
}

// migrationsUpTo copies the migrations folder with its journal cut to the first count entries.
async function migrationsUpTo(count: number): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "greenbuild-migrations-"));
  await cp(MIGRATIONS_FOLDER, folder, { recursive: true });
  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as Journal;
  await writeFile(journalPath, JSON.stringify({ ...journal, entries: journal.entries.filter((entry) => entry.idx < count) }));
  return folder;
}

// anAttempt adds a challenge, a version and an attempt by userId, with the schema of any revision.
async function anAttempt(db: Database, userId: string): Promise<void> {
  const [challenge] = await db.insert(challenges).values({ slug: `c-${uuidv7()}`, title: "C", difficulty: 3 }).returning();
  const [version] = await db
    .insert(challengeVersions)
    .values({ challengeId: challenge?.id ?? "", version: 1, specJson: {}, imageRef: "img", checkerHash: "sha256:x", source: "human" })
    .returning();
  await db.insert(attempts).values({ userId, challengeVersionId: version?.id ?? "", seed: 1, context: "catalog" });
}

describe("migrations 0005–0007 on a database whose attempts have no users", () => {
  let database: TestDatabase | undefined;
  beforeAll(async () => {
    database = await startPostgres();
  }, STARTUP_TIMEOUT_MS);
  afterAll(async () => {
    await database?.stop();
  });

  it("give each orphaned attempt a user, validate the foreign key and refuse unknown users", async () => {
    const url = database?.url ?? "";
    const folder = await migrationsUpTo(MIGRATIONS_BEFORE_USERS);
    const connection = connect(url);
    const orphanUserId = uuidv7();
    try {
      await migrate(connection.db, { migrationsFolder: folder });
      await anAttempt(connection.db, orphanUserId);

      await applyMigrations(url);

      await expect(connection.db.select({ id: users.id }).from(users)).resolves.toEqual([{ id: orphanUserId }]);
      const [foreignKey] = await connection.db.execute<{ convalidated: boolean }>(
        "select convalidated from pg_constraint where conname = 'attempts_user_id_users_id_fk'",
      );
      expect(foreignKey?.convalidated).toBe(true);
      await expect(anAttempt(connection.db, uuidv7())).rejects.toThrow();
    } finally {
      await connection.close();
      await rm(folder, { recursive: true, force: true });
    }
  }, MIGRATION_TEST_TIMEOUT_MS);
});

describe("users and auth_accounts", () => {
  const database = useMigratedDatabase();

  it("fill a new user's defaults", async () => {
    const [user] = await database().db.insert(users).values({}).returning();

    expect(user).toMatchObject({ handle: null, timezone: "UTC", locale: "en", role: "player", status: "active", ageConfirmed16At: null });
  });

  it.each([
    ["an uppercase handle", { handle: "Arslan" }],
    ["an uppercase email", { email: "Player@Example.com" }],
    ["a country that is not ISO alpha-2", { country: "Kazakhstan" }],
  ])("reject %s", async (_name, values) => {
    await expect(database().db.insert(users).values(values)).rejects.toThrow();
  });

  it("refuse a taken handle or email", async () => {
    await database().db.insert(users).values({ handle: "taken", email: "taken@example.com" });

    await expect(database().db.insert(users).values({ handle: "taken" })).rejects.toThrow();
    await expect(database().db.insert(users).values({ email: "taken@example.com" })).rejects.toThrow();
  });

  it("link one provider identity to one user and drop links with the user", async () => {
    const { db } = database();
    const [user] = await db.insert(users).values({}).returning();
    const account = { userId: user?.id ?? "", provider: "github" as const, providerUserId: "12345" };
    await db.insert(authAccounts).values(account);

    await expect(db.insert(authAccounts).values(account)).rejects.toThrow();
    await db.delete(users).where(eq(users.id, user?.id ?? ""));
    await expect(db.select().from(authAccounts).where(eq(authAccounts.providerUserId, "12345"))).resolves.toEqual([]);
  });
});
