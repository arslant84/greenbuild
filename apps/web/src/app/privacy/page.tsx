import { ACCOUNT_DELETION_DAYS, EXPORT_LINK_DAYS, PRIVACY_VERSION } from "@greenbuild/shared";
import type { Metadata } from "next";
import { LegalPage, LegalSection } from "../_legal/legal-page";

export const metadata: Metadata = { title: "Privacy Policy · greenbuild", description: "What greenbuild collects, why, and how to export or delete it." };

// The beta privacy policy a player accepts at sign-up (task 31a), from architecture.md's privacy section;
// what is recorded is PRIVACY_VERSION.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" version={PRIVACY_VERSION}>
      <LegalSection heading="What we collect">
        <p>
          Your account: email, handle, display name and the id of the GitHub or Google account you sign in with, never its password or tokens. Your play: attempts, checks, XP, ratings and
          streaks. Your sandbox sessions: the commands you type and their timings, used only to check that solves are genuine. We do not ask for your date of birth, only that you are 16 or
          older (and 18 or older to be found by companies).
        </p>
      </LegalSection>
      <LegalSection heading="Who sees it">
        <p>
          Your public game profile shows your handle, display name, level, XP, solves, streak and ratings. Companies see nothing about you unless you turn on being found, and then only an
          anonymous card until you accept a company&apos;s request. We do not sell your data.
        </p>
      </LegalSection>
      <LegalSection heading="Your consents">
        <p>Every consent you give, to these terms and policy or to being found by companies, is recorded with its version and date. You can see them, and withdraw being found, in the settings.</p>
      </LegalSection>
      <LegalSection heading="Export and deletion">
        <p>
          In the settings you can ask for all your data as a JSON file; we email you a link that works for {EXPORT_LINK_DAYS} days. You can delete your account there too: it is hidden at once,
          your consents are withdrawn and your personal data is removed within {ACCOUNT_DELETION_DAYS} days. Your attempts stay, without your name, to calibrate the challenges.
        </p>
      </LegalSection>
      <LegalSection heading="Where it is stored">
        <p>greenbuild is built to run on Microsoft Azure in the United States. Before the public launch this policy will name the operator, a contact address and how data leaves the EU.</p>
      </LegalSection>
    </LegalPage>
  );
}
