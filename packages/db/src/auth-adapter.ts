import type { Adapter, AdapterAccount, AdapterUser } from "@auth/core/adapters";
import { ValidationError } from "@greenbuild/shared";
import { and, eq } from "drizzle-orm";
import type { Database } from "./client.js";
import { authAccounts, authProvider, users } from "./schema/users.js";

type UserRow = typeof users.$inferSelect;
type Provider = (typeof authProvider.enumValues)[number];

// authAdapter is the thin Auth.js adapter of ADR-013: JWT sessions, so only the user and account
// methods. It maps Auth.js's name and image to our columns, stores emails lowercase and keeps only
// the provider's user id, never OAuth tokens. The email-link methods come with an email provider
// (D6; architecture.md, deviation 29).
export function authAdapter(db: Database): Adapter {
  return {
    async createUser(user) {
      const [row] = await db
        .insert(users)
        .values({ email: lowercaseEmail(user.email), displayName: user.name ?? null, avatarUrl: user.image ?? null })
        .returning();
      if (!row) {
        throw new Error("auth adapter: the new user row was not returned");
      }
      return toAdapterUser(row);
    },
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
  };
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
  return { id: row.id, email: row.email ?? "", emailVerified: null, name: row.displayName, image: row.avatarUrl };
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
