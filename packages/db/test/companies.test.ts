import { describe, expect, it } from "vitest";
import { challenges, companies, companyMembers } from "../src/schema/index.js";
import { uuidv7 } from "../src/uuid.js";
import { useMigratedDatabase } from "./migrated.js";
import { aUser } from "./users-fixture.js";

// architecture.md, task 31b: the minimum company tables, and private challenges tied to a real company.
describe("company tables", () => {
  const database = useMigratedDatabase();

  it("accept a private challenge of an existing company and refuse one of an unknown company", async () => {
    const { db } = database();
    const [company] = await db.insert(companies).values({ name: "Acme", domain: "acme.dev" }).returning();
    const privateChallenge = { title: "Private", difficulty: 3, visibility: "company_private" as const };

    await expect(db.insert(challenges).values({ ...privateChallenge, slug: "acme-only", companyId: company?.id ?? "" })).resolves.toBeDefined();
    await expect(db.insert(challenges).values({ ...privateChallenge, slug: "nobody", companyId: uuidv7() })).rejects.toThrow();
  });

  it("validate the challenges.company_id foreign key", async () => {
    const [foreignKey] = await database().db.execute<{ convalidated: boolean }>(
      "select convalidated from pg_constraint where conname = 'challenges_company_id_companies_id_fk'",
    );

    expect(foreignKey?.convalidated).toBe(true);
  });

  it("reject an uppercase or taken domain", async () => {
    const { db } = database();
    await db.insert(companies).values({ name: "Taken", domain: "taken.dev" });

    await expect(db.insert(companies).values({ name: "Upper", domain: "Upper.dev" })).rejects.toThrow();
    await expect(db.insert(companies).values({ name: "Again", domain: "taken.dev" })).rejects.toThrow();
  });

  it("keep one membership per user and company", async () => {
    const { db } = database();
    const [company] = await db.insert(companies).values({ name: "Team", domain: "team.dev" }).returning();
    const member = { companyId: company?.id ?? "", userId: await aUser(db), role: "recruiter" as const };
    await db.insert(companyMembers).values(member);

    await expect(db.insert(companyMembers).values({ ...member, role: "owner" })).rejects.toThrow();
  });
});
