import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { attempts, challenges, challengeVersions } from "../src/schema/index.js";
import { uuidv7 } from "../src/uuid.js";
import { useMigratedDatabase, type MigratedDatabase } from "./migrated.js";
import { aUser } from "./users-fixture.js";

async function aVersion({ db }: MigratedDatabase): Promise<string> {
  const [challenge] = await db.insert(challenges).values({ slug: `c-${uuidv7()}`, title: "C", difficulty: 3 }).returning();
  const [version] = await db
    .insert(challengeVersions)
    .values({ challengeId: challenge?.id ?? "", version: 1, specJson: {}, imageRef: "img", checkerHash: "sha256:x", source: "human" })
    .returning();
  return version?.id ?? "";
}

describe("one active attempt per user", () => {
  const database = useMigratedDatabase();

  it("refuses a second starting or ready attempt, allows one after the first ends", async () => {
    const { db } = database();
    const userId = await aUser(db);
    const attempt = { userId, challengeVersionId: await aVersion(database()), seed: 1, context: "catalog" as const };
    const [first] = await db.insert(attempts).values(attempt).returning();

    await expect(db.insert(attempts).values(attempt)).rejects.toThrow();
    await db.update(attempts).set({ status: "ready" }).where(eq(attempts.id, first?.id ?? ""));
    await expect(db.insert(attempts).values(attempt)).rejects.toThrow();
    await db.update(attempts).set({ status: "solved" }).where(eq(attempts.id, first?.id ?? ""));
    await expect(db.insert(attempts).values(attempt).returning()).resolves.toHaveLength(1);
  });

  it("lets different users start at the same time", async () => {
    const { db } = database();
    const challengeVersionId = await aVersion(database());
    const starts = [await aUser(db), await aUser(db)].map((userId) => db.insert(attempts).values({ userId, challengeVersionId, seed: 1, context: "catalog" }));

    await expect(Promise.all(starts)).resolves.toHaveLength(2);
  });
});
