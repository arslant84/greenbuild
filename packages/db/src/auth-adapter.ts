import type { Adapter, AdapterAccount, AdapterUser, VerificationToken } from "@auth/core/adapters";
import { ValidationError } from "@greenbuild/shared";
import { and, eq } from "drizzle-orm";
import type { Database } from "./client.js";
import { authAccounts, authProvider, users, verificationTokens } from "./schema/users.js";
import { createConfirmedUser } from "./sign-up.js";

type UserRow = typeof users.$inferSelect;
type Provider = (typeof authProvider.enumValues)[number];

export interface AuthAdapterOptions {
  // Whether the browser signing in carries the player's 16+ confirmation (task 30b). Without it a new
  // player is created only with a confirmation recorded for their address.
  confirmedInBrowser: () => Promise<boolean>;
}

// authAdapter is the thin Auth.js adapter of ADR-013: JWT sessions, so only the user, account and
// email-link methods. It maps Auth.js's name, image and emailVerified to our columns, stores emails
// lowercase and keeps only the provider's user id, never OAuth tokens. It creates no player without
// the 16+ confirmation (task 30b).
export function authAdapter(db: Database, options: AuthAdapterOptions): Adapter {
  return {
    createUser: async (user) => createUser(db, user, await options.confirmedInBrowser()),
    async getUser(id) {
      const [row] = await db.select().from(users).where(eq(users.id, id));
      return row ? toAdapterUser(row) : null;
    },
    async getUserByEmail(email) {
      const lowercase = lowercaseEmail(email);
      if (!lowercase) {
        return null;
      }
      const [row] = await db.select().from(users).where(eq(users.email, lowercase));
      return row ? toAdapterUser(row) : null;
    },
    getUserByAccount: (account) => getUserByAccount(db, account),
    updateUser: (user) => updateUser(db, user),
    async linkAccount(account: AdapterAccount) {
      await db
        .insert(authAccounts)
        .values({ userId: account.userId, provider: knownProvider(account.provider), providerUserId: account.providerAccountId })
        .onConflictDoNothing();
    },
    async createVerificationToken({ identifier, token, expires }) {
      await db.insert(verificationTokens).values({ identifier: identifier.toLowerCase(), token, expiresAt: expires });
      return { identifier, token, expires };
    },
    useVerificationToken: (params) => useVerificationToken(db, params),
  };
}

async function createUser(db: Database, user: AdapterUser, confirmedInBrowser: boolean): Promise<AdapterUser> {
  const row = await createConfirmedUser(
    db,
    { email: lowercaseEmail(user.email), emailVerifiedAt: user.emailVerified, displayName: user.name ?? null, avatarUrl: user.image ?? null },
    confirmedInBrowser,
  );
  return toAdapterUser(row);
}

// useVerificationToken deletes the token and answers it, so a link signs in once; Auth.js checks expiry.
async function useVerificationToken(db: Database, { identifier, token }: { identifier: string; token: string }): Promise<VerificationToken | null> {
  const [row] = await db
    .delete(verificationTokens)
    .where(and(eq(verificationTokens.identifier, identifier.toLowerCase()), eq(verificationTokens.token, token)))
    .returning();
  return row ? { identifier: row.identifier, token: row.token, expires: row.expiresAt } : null;
}

async function getUserByAccount(db: Database, { provider, providerAccountId }: Pick<AdapterAccount, "provider" | "providerAccountId">): Promise<AdapterUser | null> {
  const [row] = await db
    .select({ user: users })
    .from(authAccounts)
    .innerJoin(users, eq(users.id, authAccounts.userId))
    .where(and(eq(authAccounts.provider, knownProvider(provider)), eq(authAccounts.providerUserId, providerAccountId)));
  return row ? toAdapterUser(row.user) : null;
}

async function updateUser(db: Database, user: Partial<AdapterUser> & Pick<AdapterUser, "id">): Promise<AdapterUser> {
  const changes: Partial<typeof users.$inferInsert> = {};
  if (user.email !== undefined) changes.email = lowercaseEmail(user.email);
  if (user.name !== undefined) changes.displayName = user.name;
  if (user.image !== undefined) changes.avatarUrl = user.image;
  if (user.emailVerified !== undefined) changes.emailVerifiedAt = user.emailVerified;
  const [row] =
    Object.keys(changes).length === 0
      ? await db.select().from(users).where(eq(users.id, user.id))
      : await db.update(users).set(changes).where(eq(users.id, user.id)).returning();
  if (!row) {
    throw new Error(`auth adapter: user ${user.id} not found`);
  }
  return toAdapterUser(row);
}

// Auth.js types email as a string; a GitHub account without a public email has none in our row.
function toAdapterUser(row: UserRow): AdapterUser {
  return { id: row.id, email: row.email ?? "", emailVerified: row.emailVerifiedAt, name: row.displayName, image: row.avatarUrl };
}

function lowercaseEmail(email: string | null | undefined): string | null {
  return email ? email.toLowerCase() : null;
}

function knownProvider(provider: string): Provider {
  const known = authProvider.enumValues.find((value) => value === provider);
  if (!known) {
    throw new ValidationError(`auth provider ${provider}: must be one of ${authProvider.enumValues.join(", ")}`);
  }
  return known;
}
