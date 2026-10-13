import type { Adapter } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

const credentialsSchema = z.object({ email: z.email() });

// e2eSignIn signs a test player in by email alone, so Playwright needs no mailbox (task 30d). It
// finds or creates the player through the same adapter as real sign-in. loadAuthConfig turns it on
// only with GREENBUILD_E2E_AUTH=1 and refuses it in production.
export function e2eSignIn(adapter: Adapter) {
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
      const user = (await getUserByEmail(email)) ?? (await createUser({ id: "", email, emailVerified: null }));
      return { id: user.id, email: user.email };
    },
  });
}
