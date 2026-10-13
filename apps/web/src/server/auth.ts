import { authAdapter, connect } from "@greenbuild/db/auth";
import NextAuth, { type NextAuthConfig, type NextAuthResult } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { e2eSignIn } from "./e2e-sign-in";
import { emailSignIn } from "./email-sign-in";
import { type AuthConfig, loadAuthConfig } from "../config/auth";

// Sign-in with GitHub and an email link (architecture.md, task 30a): the thin adapter of ADR-013 and JWT
// sessions, so no session table. Built on the first request, so `next build` needs no settings.
let instance: NextAuthResult | null | undefined;

export function authInstance(): NextAuthResult | null {
  if (instance === undefined) {
    const config = loadAuthConfig();
    instance = config ? NextAuth(authOptions(config)) : null;
  }
  return instance;
}

function authOptions(config: AuthConfig): NextAuthConfig {
  const adapter = authAdapter(connect(config.databaseUrl).db);
  const providers: NextAuthConfig["providers"] = [emailSignIn({ server: config.emailServer, from: config.emailFrom })];
  if (config.github) {
    providers.push(GitHub({ clientId: config.github.clientId, clientSecret: config.github.clientSecret }));
  }
  if (config.google) {
    providers.push(Google({ clientId: config.google.clientId, clientSecret: config.google.clientSecret }));
  }
  if (config.e2eSignIn) {
    providers.push(e2eSignIn(adapter));
  }
  return {
    secret: config.secret,
    adapter,
    session: { strategy: "jwt" },
    providers,
    callbacks: {
      // The JWT's subject is our user id (the adapter's); the API token names it (task 30c).
      session({ session, token }) {
        if (token.sub) {
          session.user.id = token.sub;
        }
        return session;
      },
    },
  };
}
