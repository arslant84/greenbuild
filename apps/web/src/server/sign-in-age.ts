import { type AgeStatus, ageStatus, confirmUser, type connect, hasAgeConfirmation, recordAgeConfirmation, type SignInIdentity } from "@greenbuild/db/auth";
import type { NextAuthConfig } from "next-auth";
import { ageConfirmedInBrowser } from "./age-confirmation";
import { LINK_MAX_AGE_SEC } from "./email-sign-in";
import { AGE_REQUIRED_PATH } from "./sign-in-paths";

type Database = ReturnType<typeof connect>["db"];
export type SignInCallback = NonNullable<NonNullable<NextAuthConfig["callbacks"]>["signIn"]>;

// The steps of a sign-in: asking for an email link, and completing it by the link or through GitHub.
export type SignInStep = "request-link" | "complete";
export type AgeDecision = "allow" | "record" | "confirm" | "deny";

// ageDecision is the 16+ rule at one sign-in step (task 30b). A confirmed player always passes. Anyone
// else needs the confirmation: from this browser when asking for a link, which records it for the
// address so the link works anywhere; from this browser or that record when completing. A player
// created before the rule is completed then; a new one is created by the adapter, which checks again.
export function ageDecision(status: AgeStatus, step: SignInStep, confirmation: { inBrowser: boolean; recorded: boolean }): AgeDecision {
  if (status.kind === "confirmed") {
    return "allow";
  }
  if (step === "request-link") {
    return confirmation.inBrowser ? "record" : "deny";
  }
  if (!confirmation.inBrowser && !confirmation.recorded) {
    return "deny";
  }
  return status.kind === "unconfirmed" ? "confirm" : "allow";
}

// ageCheck is Auth.js's signIn callback for the email link and GitHub; the e2e sign-in confirms its test
// players itself.
export function ageCheck(db: Database): SignInCallback {
  return async ({ account, email }) => {
    if (!account || account.type === "credentials") {
      return true;
    }
    const identity = signInIdentity(account);
    const status = await ageStatus(db, identity);
    const step: SignInStep = email?.verificationRequest ? "request-link" : "complete";
    const recorded = "email" in identity && step === "complete" ? await hasAgeConfirmation(db, identity.email) : false;
    const decision = ageDecision(status, step, { inBrowser: await ageConfirmedInBrowser(), recorded });
    return decision === "deny" ? AGE_REQUIRED_PATH : applyDecision(db, decision, { identity, status });
  };
}

async function applyDecision(db: Database, decision: AgeDecision, { identity, status }: { identity: SignInIdentity; status: AgeStatus }): Promise<true> {
  if (decision === "record" && "email" in identity) {
    await recordAgeConfirmation(db, identity.email, new Date(Date.now() + LINK_MAX_AGE_SEC * 1000));
  }
  if (decision === "confirm" && status.kind === "unconfirmed") {
    await confirmUser(db, status.userId);
  }
  return true;
}

function signInIdentity(account: { type: string; provider: string; providerAccountId: string }): SignInIdentity {
  if (account.type === "email") {
    return { email: account.providerAccountId };
  }
  if (account.provider !== "github" && account.provider !== "google") {
    throw new Error(`sign-in: unknown provider ${account.provider}`);
  }
  return { provider: account.provider, providerUserId: account.providerAccountId };
}
