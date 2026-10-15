import { ACCOUNT_DELETION_DAYS, TERMS_VERSION } from "@greenbuild/shared";
import type { Metadata } from "next";
import { LegalPage, LegalSection } from "../_legal/legal-page";

export const metadata: Metadata = { title: "Terms of Service · greenbuild", description: "The beta terms of greenbuild, the daily incident game." };

// The beta terms a player accepts at sign-up (task 31a): what is recorded is TERMS_VERSION.
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" version={TERMS_VERSION}>
      <LegalSection heading="What greenbuild is">
        <p>greenbuild is a game: each day you get a broken server in a sandbox and fix it. Solving challenges earns XP and a skill rating. It is free for engineers.</p>
      </LegalSection>
      <LegalSection heading="Who can use it">
        <p>You must be 16 or older to create an account. Being found by companies needs you to be 18 or older and to turn it on yourself.</p>
      </LegalSection>
      <LegalSection heading="Fair play">
        <p>Solve challenges yourself. Do not attack the sandboxes or the service, share solutions to get ratings you did not earn, or run more than one account. We check solves for signs of cheating and may void attempts or close accounts that break these rules.</p>
      </LegalSection>
      <LegalSection heading="Your account">
        <p>You can export your data or delete your account in the settings at any time. A deleted account is hidden at once and its personal data is removed within {ACCOUNT_DELETION_DAYS} days.</p>
      </LegalSection>
      <LegalSection heading="The beta">
        <p>greenbuild is in beta: features, ratings and these terms may change, and the service may be unavailable at times. It is provided as is, without guarantees.</p>
      </LegalSection>
    </LegalPage>
  );
}
