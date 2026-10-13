import type { EmailConfig } from "next-auth/providers/email";
import { createTransport } from "nodemailer";

// A sign-in link works for a day, as Auth.js's own default.
const LINK_MAX_AGE_SEC = 24 * 60 * 60;

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
      const sent = await transport.sendMail({
        to: identifier,
        from,
        subject: "Sign in to greenbuild",
        text: `Use this link to sign in to greenbuild:\n${url}\n\nIt works once, for 24 hours. If you did not ask for it, ignore this email.\n`,
      });
      if (sent.rejected.length > 0) {
        throw new Error("sign-in email: the mail server rejected the recipient");
      }
    },
  };
}
