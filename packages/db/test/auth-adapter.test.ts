import type { Adapter, AdapterUser } from "@auth/core/adapters";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { authAdapter } from "../src/auth-adapter.js";
import { authAccounts } from "../src/schema/index.js";
import { useMigratedDatabase } from "./migrated.js";

// ADR-013 (task 30a): the thin Auth.js adapter on a migrated PostgreSQL 16.
const database = useMigratedDatabase();
let githubIds = 0;

// Auth.js passes its own id to createUser; the adapter keeps ours.
function newUser(email: string): AdapterUser {
  return { id: "auth-js-id", email, emailVerified: null, name: "Ada Lovelace", image: "https://avatars.example/ada.png" };
}

const NEEDED = ["createUser", "getUser", "getUserByEmail", "getUserByAccount", "updateUser", "linkAccount", "createVerificationToken", "useVerificationToken"] as const;
type Needed = Required<Pick<Adapter, (typeof NEEDED)[number]>>;

function adapter(): Needed {
  const methods = authAdapter(database().db, { confirmedInBrowser: async () => true });
  const missing = NEEDED.filter((name) => !methods[name]);
  if (missing.length > 0) {
    throw new Error(`the adapter lacks ${missing.join(", ")}, which JWT sessions and the email link need`);
  }
  return methods as Needed;
}

function githubAccount(userId: string): { userId: string; type: "oauth"; provider: string; providerAccountId: string; access_token: string } {
  githubIds += 1;
  return { userId, type: "oauth", provider: "github", providerAccountId: String(githubIds), access_token: "gho_secret" };
}

describe("authAdapter for users and accounts", () => {
  it("creates a user with our id and a lowercase email, and finds it by id and by email in any case", async () => {
    const created = await adapter().createUser(newUser("Ada@Example.COM"));

    expect(created).toMatchObject({ email: "ada@example.com", name: "Ada Lovelace", image: "https://avatars.example/ada.png", emailVerified: null });
    expect(created.id).not.toBe("auth-js-id");
    expect(await adapter().getUser(created.id)).toEqual(created);
    expect(await adapter().getUserByEmail("ADA@example.com")).toEqual(created);
    expect(await adapter().getUserByEmail("nobody@example.com")).toBeNull();
  });

  it("keeps a user without an email as one without, not as an empty email", async () => {
    const created = await adapter().createUser(newUser(""));

    expect(created.email).toBe("");
    expect(await adapter().getUserByEmail("")).toBeNull();
  });

  it("links a GitHub account once, finds the user by it, and stores no OAuth token", async () => {
    const user = await adapter().createUser(newUser("grace@example.com"));
    const account = githubAccount(user.id);

    await adapter().linkAccount(account);
    await adapter().linkAccount(account);
    expect(await adapter().getUserByAccount({ provider: "github", providerAccountId: account.providerAccountId })).toEqual(user);
    expect(await adapter().getUserByAccount({ provider: "github", providerAccountId: "unknown" })).toBeNull();
    const rows = await database().db.select().from(authAccounts).where(eq(authAccounts.userId, user.id));
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain("gho_secret");
  });

  it("refuses a provider the schema does not know", async () => {
    const user = await adapter().createUser(newUser("linus@example.com"));

    await expect(adapter().linkAccount({ ...githubAccount(user.id), provider: "gitlab" })).rejects.toThrow("auth provider gitlab");
  });

  it("updates only the fields given, lowercasing the email", async () => {
    const user = await adapter().createUser(newUser("margaret@example.com"));

    expect(await adapter().updateUser({ id: user.id, name: "Margaret Hamilton" })).toEqual({ ...user, name: "Margaret Hamilton" });
    expect(await adapter().updateUser({ id: user.id, email: "M.Hamilton@Example.com" })).toMatchObject({ email: "m.hamilton@example.com", image: user.image });
  });
});

describe("authAdapter for the email link", () => {
  it("keeps when an email was verified, at sign-up and later", async () => {
    const verifiedAt = new Date("2026-10-13T09:00:00Z");
    const viaLink = await adapter().createUser({ ...newUser("barbara@example.com"), emailVerified: verifiedAt });
    const viaGithub = await adapter().createUser(newUser("frances@example.com"));

    expect(viaLink.emailVerified).toEqual(verifiedAt);
    expect(viaGithub.emailVerified).toBeNull();
    expect((await adapter().updateUser({ id: viaGithub.id, emailVerified: verifiedAt })).emailVerified).toEqual(verifiedAt);
  });

  it("answers a sign-in token once, for the email in any case, and nothing for an unknown one", async () => {
    const expires = new Date("2026-10-13T10:00:00Z");
    await adapter().createVerificationToken({ identifier: "Katherine@Example.com", token: "hashed-token", expires });

    expect(await adapter().useVerificationToken({ identifier: "katherine@example.com", token: "other" })).toBeNull();
    expect(await adapter().useVerificationToken({ identifier: "KATHERINE@example.com", token: "hashed-token" })).toEqual({ identifier: "katherine@example.com", token: "hashed-token", expires });
    expect(await adapter().useVerificationToken({ identifier: "katherine@example.com", token: "hashed-token" })).toBeNull();
  });
});
