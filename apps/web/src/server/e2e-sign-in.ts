import { confirmUser, type connect, recordAgeConfirmation } from "@greenbuild/db/auth";
import type { Adapter } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

type Database = ReturnType<typeof connect>["db"];

const credentialsSchema = z.object({ email: z.email() });
// A test player has confirmed 16+ (task 30b); the confirmation only has to outlive the next statement.
const CONFIRMATION_LIFETIME_MS = 60_000;

// e2eSignIn signs a test player in by email alone, so Playwright needs no mailbox (task 30d). It
// finds or creates the player through the same adapter as real sign-in, as a player who confirmed
// being 16 or older. loadAuthConfig turns it on only with GREENBUILD_E2E_AUTH=1 and refuses it in
// production.
export function e2eSignIn(adapter: Adapter, db: Database) {
  const { getUserByEmail, createUser } = adapter;
  if (!getUserByEmail || !createUser) {
    throw new Error("e2e sign-in: the adapter cannot find or create users");
  }
  return Credentials({
    id: "e2e",
    name: "Test player",
    credentials: { email: { label: "Email", type: "email" } },
    async authorize(credentials) {
      const parsed = credentialsSchema.safeParse(credentials);
      if (!parsed.success) {
        return null;
      }
      const email = parsed.data.email.toLowerCase();
      const existing = await getUserByEmail(email);
      if (existing) {
        await confirmUser(db, existing.id);
        return { id: existing.id, email: existing.email };
      }
      await recordAgeConfirmation(db, email, new Date(Date.now() + CONFIRMATION_LIFETIME_MS));
      const user = await createUser({ id: "", email, emailVerified: null });
      return { id: user.id, email: user.email };
    },
  });
}
