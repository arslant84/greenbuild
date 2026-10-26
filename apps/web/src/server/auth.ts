import { authAdapter, connect } from "@greenbuild/db/auth";
import NextAuth, { type NextAuthConfig, type NextAuthResult } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { ageConfirmedInBrowser } from "./age-confirmation";
import { e2eSignIn } from "./e2e-sign-in";
import { emailSignIn } from "./email-sign-in";
import { ageCheck, type SignInCallback } from "./sign-in-age";
import { linkLimit, redisCounter } from "./sign-in-limit";
import { logger } from "./logger";
import { SIGN_IN_PATH } from "./sign-in-paths";
import { type AuthConfig, loadAuthConfig } from "../config/auth";

// Sign-in with GitHub and an email link (architecture.md, task 30a): the thin adapter of ADR-013 and JWT
// sessions, so no session table. Built on the first request, so `next build` needs no settings.
let instance: NextAuthResult | null | undefined;

// Without sign-in no player can sign in and every page that reads the API fails, so a local run without
// the settings says so once, where the developer sees it.
export const SIGN_IN_OFF = "sign-in is off: AUTH_SECRET is not set, so no player can sign in and the API answers 401; start the local stack with `pnpm play:up`, which sets it";

export function authInstance(): NextAuthResult | null {
  if (instance === undefined) {
    const config = loadAuthConfig();
    instance = config ? NextAuth(authOptions(config)) : null;
    if (!config) {
      logger.error(SIGN_IN_OFF);
    }
  }
  return instance;
}

function authOptions(config: AuthConfig): NextAuthConfig {
  const { db } = connect(config.databaseUrl);
  const adapter = authAdapter(db, { confirmedInBrowser: ageConfirmedInBrowser });
  const providers: NextAuthConfig["providers"] = [emailSignIn({ server: config.emailServer, from: config.emailFrom })];
  if (config.github) {
    providers.push(GitHub({ clientId: config.github.clientId, clientSecret: config.github.clientSecret }));
  }
  if (config.google) {
    providers.push(Google({ clientId: config.google.clientId, clientSecret: config.google.clientSecret }));
  }
  if (config.e2eSignIn) {
    providers.push(e2eSignIn(adapter, db));
  }
  return {
    secret: config.secret,
    adapter,
    session: { strategy: "jwt" },
    // Our sign-in screen (task 30b) shows sign-in and its errors; it asks for links without leaving it.
    pages: { signIn: SIGN_IN_PATH, error: SIGN_IN_PATH },
    providers,
    callbacks: {
      signIn: signInRules(db, config.redisUrl),
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

// The sign-in rules, in order: at most so many email link requests (task 30b-4), then the 16+ rule (task
// 30b), which the adapter checks again when it creates a player.
function signInRules(db: ReturnType<typeof connect>["db"], redisUrl: string): SignInCallback {
  const limit = linkLimit(redisCounter(redisUrl));
  const age = ageCheck(db);
  return async (params) => (await limit({ email: params.user.email ?? "", verificationRequest: params.email?.verificationRequest === true })) ?? age(params);
}
