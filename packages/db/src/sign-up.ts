import { AgeNotConfirmedError, PRIVACY_VERSION, TERMS_VERSION } from "@greenbuild/shared";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import type { Database } from "./client.js";
import { consents } from "./schema/consent.js";
import { ageConfirmations, users } from "./schema/users.js";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type NewUser = Pick<typeof users.$inferInsert, "email" | "emailVerifiedAt" | "displayName" | "avatarUrl">;

// What a player accepts at sign-up (task 31a): the current terms and privacy policy.
const SIGN_UP_CONSENTS = [
  { kind: "terms", version: TERMS_VERSION },
  { kind: "privacy", version: PRIVACY_VERSION },
] as const;

// recordAgeConfirmation keeps a player's 16+ confirmation for their address until expiresAt (task 30b),
// so the email link they asked for creates their account in any browser.
export async function recordAgeConfirmation(db: Database, email: string, expiresAt: Date): Promise<void> {
  await db
    .insert(ageConfirmations)
    .values({ email: email.toLowerCase(), expiresAt })
    .onConflictDoUpdate({ target: ageConfirmations.email, set: { expiresAt } });
}

export async function hasAgeConfirmation(db: Database, email: string): Promise<boolean> {
  const [row] = await db
    .select({ email: ageConfirmations.email })
    .from(ageConfirmations)
    .where(and(eq(ageConfirmations.email, email.toLowerCase()), gt(ageConfirmations.expiresAt, new Date())));
  return row !== undefined;
}

// createConfirmedUser creates a player only with the 16+ confirmation, from this browser or recorded for
// their address, and with it records the sign-up consents: one transaction, so no account exists
// without them. A recorded confirmation is used up.
export async function createConfirmedUser(db: Database, user: NewUser, confirmedInBrowser: boolean): Promise<typeof users.$inferSelect> {
  return db.transaction(async (tx) => {
    const recorded = user.email ? await takeAgeConfirmation(tx, user.email) : false;
    if (!confirmedInBrowser && !recorded) {
      throw new AgeNotConfirmedError();
    }
    const [row] = await tx
      .insert(users)
      .values({ ...user, ageConfirmed16At: new Date() })
      .returning();
    if (!row) {
      throw new Error("sign-up: the new user row was not returned");
    }
    await grantSignUpConsents(tx, row.id);
    return row;
  });
}

// confirmUser completes a player created before task 30b who confirms 16+ at sign-in: the date, kept if
// already set, and the sign-up consents they do not hold yet.
export async function confirmUser(db: Database, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ ageConfirmed16At: new Date() })
      .where(and(eq(users.id, userId), isNull(users.ageConfirmed16At)));
    await grantSignUpConsents(tx, userId);
  });
}

async function takeAgeConfirmation(tx: Transaction, email: string): Promise<boolean> {
  const taken = await tx
    .delete(ageConfirmations)
    .where(and(eq(ageConfirmations.email, email.toLowerCase()), gt(ageConfirmations.expiresAt, new Date())))
    .returning({ email: ageConfirmations.email });
  return taken.length > 0;
}

async function grantSignUpConsents(tx: Transaction, userId: string): Promise<void> {
  const held = await tx
    .select({ kind: consents.kind, version: consents.version })
    .from(consents)
    .where(and(eq(consents.userId, userId), inArray(consents.kind, ["terms", "privacy"]), isNull(consents.revokedAt)));
  const missing = SIGN_UP_CONSENTS.filter(({ kind, version }) => !held.some((row) => row.kind === kind && row.version === version));
  if (missing.length > 0) {
    await tx.insert(consents).values(missing.map(({ kind, version }) => ({ userId, kind, version })));
  }
}
