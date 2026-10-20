import { EMAIL_COLORS, type Email, emailHtml, emailText, escapeHtml, MONO } from "./layout.js";

const SUBJECT = "Sign in to greenbuild";
const LABEL = "SIGN IN";

// signInEmail is Email 1, "Magic Link", of the Email Template System (8:13213) for the sign-in link (task
// 30a). The frame's "15 minutes" is the link's real lifetime here.
export function signInEmail({ url, lifetimeHours }: { url: string; lifetimeHours: number }): Email {
  const c = EMAIL_COLORS;
  const link = escapeHtml(url);
  const rows = `
      <tr><td style="padding-top: 28px; padding-bottom: 8px;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: ${c.text}; letter-spacing: -0.02em;">${SUBJECT}</h1>
      </td></tr>
      <tr><td style="padding-bottom: 24px;">
        <p style="margin: 0; font-size: 14px; line-height: 22px; color: ${c.muted};">Use this link to sign in. It works once, for <strong style="color: ${c.text};">${lifetimeHours} hours</strong>.</p>
      </td></tr>
      <tr><td style="padding-bottom: 28px;">
        <a href="${link}" target="_blank" style="display: inline-block; background-color: ${c.accent}; color: ${c.onAccent}; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px;">${SUBJECT} &rarr;</a>
      </td></tr>
      <tr><td style="background-color: ${c.panel}; border-radius: 8px; border: 1px solid ${c.border}; padding: 16px;">
        <span style="display: block; font-family: ${MONO}; font-size: 11px; color: ${c.muted}; margin-bottom: 6px; text-transform: uppercase;">Sign-in link</span>
        <span style="font-family: ${MONO}; font-size: 11px; line-height: 16px; color: ${c.accent}; word-break: break-all;">${link}</span>
      </td></tr>
      <tr><td style="padding-top: 24px; padding-bottom: 24px;">
        <p style="margin: 0; font-size: 12px; line-height: 18px; color: ${c.muted};">If you did not ask for it, someone may have typed your address by mistake. Ignore this email: nothing happens without the link.</p>
      </td></tr>`;
  return {
    subject: SUBJECT,
    html: emailHtml({ label: LABEL, rows }),
    text: emailText({
      label: LABEL,
      lines: [
        SUBJECT,
        "",
        `Use this link to sign in. It works once, for ${lifetimeHours} hours:`,
        url,
        "",
        "If you did not ask for it, ignore this email: nothing happens without the link.",
      ],
    }),
  };
}
