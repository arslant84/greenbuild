import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { consents, privacyRequests, userSettings } from "../src/schema/index.js";
import { useMigratedDatabase } from "./migrated.js";
import { aUser } from "./users-fixture.js";

// architecture.md, task 31a: privacy by default, and a consent history by document version.
describe("consent tables", () => {
  const database = useMigratedDatabase();

  it("start a player hidden from companies, sharing nothing and with reminders off", async () => {
    const { db } = database();
    const [settings] = await db.insert(userSettings).values({ userId: await aUser(db) }).returning();

    expect(settings).toMatchObject({ discoveryMode: "hidden", gameProfilePublic: true, revealedFields: [], notifyEmail: false, notifyPush: false });
  });

  it("keep one settings row per player", async () => {
    const { db } = database();
    const userId = await aUser(db);
    await db.insert(userSettings).values({ userId });

    await expect(db.insert(userSettings).values({ userId })).rejects.toThrow();
  });

  it("keep a revoked consent next to the later one", async () => {
    const { db } = database();
    const userId = await aUser(db);
    const [first] = await db.insert(consents).values({ userId, kind: "terms", version: "2026-10-01" }).returning();
    await db.update(consents).set({ revokedAt: new Date() }).where(eq(consents.id, first?.id ?? ""));
    await db.insert(consents).values({ userId, kind: "terms", version: "2026-11-01" });

    const history = await db.select().from(consents).where(eq(consents.userId, userId));
    expect(history.map((consent) => [consent.version, consent.revokedAt === null])).toEqual([
      ["2026-10-01", false],
      ["2026-11-01", true],
    ]);
  });

  it("record a privacy request as pending", async () => {
    const { db } = database();
    const [request] = await db.insert(privacyRequests).values({ userId: await aUser(db), kind: "export" }).returning();

    expect(request).toMatchObject({ status: "pending", completedAt: null });
    expect(request?.requestedAt).toBeInstanceOf(Date);
  });
});
