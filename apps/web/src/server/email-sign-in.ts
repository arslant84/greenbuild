import { signInEmail } from "@greenbuild/shared";
import type { EmailConfig } from "next-auth/providers/email";
import { createTransport } from "nodemailer";
import { LINK_LIFETIME_HOURS } from "./link-limit";

const SECONDS_PER_HOUR = 60 * 60;
export const LINK_MAX_AGE_SEC = LINK_LIFETIME_HOURS * SECONDS_PER_HOUR;

// emailSignIn sends the sign-in link over SMTP: Mailpit locally, the D6 provider elsewhere. It builds
// Auth.js's EmailConfig itself because next-auth's Nodemailer provider does not type-check with
// exactOptionalPropertyTypes (its `server` is optional where EmailConfig needs it defined).
export function emailSignIn({ server, from }: { server: string; from: string }): EmailConfig {
  const transport = createTransport(server);
  return {
    id: "email",
    type: "email",
    name: "Email",
    from,
    maxAge: LINK_MAX_AGE_SEC,
    async sendVerificationRequest({ identifier, url }) {
      // Email 1 of the Email Template System (task 52).
      const email = signInEmail({ url, lifetimeHours: LINK_LIFETIME_HOURS });
      const sent = await transport.sendMail({ to: identifier, from, subject: email.subject, text: email.text, html: email.html });
      if (sent.rejected.length > 0) {
        throw new Error("sign-in email: the mail server rejected the recipient");
      }
    },
  };
}
