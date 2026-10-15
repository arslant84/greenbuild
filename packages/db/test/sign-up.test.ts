import { randomUUID } from "node:crypto";
import { AgeNotConfirmedError, PRIVACY_VERSION, TERMS_VERSION } from "@greenbuild/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { consents, users } from "../src/schema/index.js";
import { confirmUser, createConfirmedUser, hasAgeConfirmation, recordAgeConfirmation } from "../src/sign-up.js";
import { useMigratedDatabase } from "./migrated.js";

// Task 30b: no account exists without the 16+ confirmation; task 31a: sign-up records the consents.
const database = useMigratedDatabase();
const LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;

function anEmail(): string {
  return `${randomUUID()}@example.com`;
}

async function signUpConsents(userId: string): Promise<{ kind: string; version: string }[]> {
  const rows = await database().db.select({ kind: consents.kind, version: consents.version }).from(consents).where(eq(consents.userId, userId));
  return rows.sort((a, b) => a.kind.localeCompare(b.kind));
}

const EXPECTED_CONSENTS = [
  { kind: "privacy", version: PRIVACY_VERSION },
  { kind: "terms", version: TERMS_VERSION },
];

describe("createConfirmedUser", () => {
  it("creates a player confirmed in this browser with the 16+ date and the terms and privacy consents", async () => {
    const user = await createConfirmedUser(database().db, { email: anEmail() }, true);

    expect(user.ageConfirmed16At).toBeInstanceOf(Date);
    expect(await signUpConsents(user.id)).toEqual(EXPECTED_CONSENTS);
  });

  it("refuses a player with no confirmation, and leaves no account behind", async () => {
    const email = anEmail();

    await expect(createConfirmedUser(database().db, { email }, false)).rejects.toBeInstanceOf(AgeNotConfirmedError);
    expect(await database().db.select().from(users).where(eq(users.email, email))).toEqual([]);
  });

  it("creates a player from the confirmation recorded for their address, in any browser, and uses it up", async () => {
    const email = anEmail();
    await recordAgeConfirmation(database().db, email.toUpperCase(), new Date(Date.now() + LINK_LIFETIME_MS));

    const user = await createConfirmedUser(database().db, { email }, false);

    expect(user.ageConfirmed16At).toBeInstanceOf(Date);
    expect(await hasAgeConfirmation(database().db, email)).toBe(false);
  });

  it("refuses an expired confirmation", async () => {
    const email = anEmail();
    await recordAgeConfirmation(database().db, email, new Date(Date.now() - 1));

    await expect(createConfirmedUser(database().db, { email }, false)).rejects.toBeInstanceOf(AgeNotConfirmedError);
  });
});

describe("confirmUser", () => {
  it("completes a player created before 16+ was asked, once", async () => {
    const [created] = await database().db.insert(users).values({ email: anEmail() }).returning();
    const userId = created?.id ?? "";

    await confirmUser(database().db, userId);
    const [first] = await database().db.select().from(users).where(eq(users.id, userId));
    await confirmUser(database().db, userId);
    const [second] = await database().db.select().from(users).where(eq(users.id, userId));

    expect(first?.ageConfirmed16At).toBeInstanceOf(Date);
    expect(second?.ageConfirmed16At).toEqual(first?.ageConfirmed16At);
    expect(await signUpConsents(userId)).toEqual(EXPECTED_CONSENTS);
  });
});
