// The frame shared by greenbuild's emails (Figma "Email Template System", 8:13213, laid out from the
// owner's Stitch copy): a 560 px card on a dark page, the brand line, the body and a footer. Email clients
// ignore stylesheets, so every style is inline.

export interface Email {
  subject: string;
  html: string;
  text: string;
}

export const EMAIL_COLORS = {
  page: "#0A0A0B",
  card: "#111113",
  panel: "#18181B",
  text: "#E5E2E3",
  muted: "#859397",
  border: "#27272A",
  accent: "#22D3EE",
  onAccent: "#0A0A0B",
  streak: "#FFC640",
} as const;

export const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export const MONO = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// escapeHtml makes a value safe to place in an email's HTML, as text or in a quoted attribute.
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

// emailHtml wraps rows (`<tr>…</tr>`) in the frame: the brand line on top, the footer below.
export function emailHtml({ label, rows }: { label: string; rows: string }): string {
  const c = EMAIL_COLORS;
  return `<!doctype html>
<html lang="en"><body style="margin: 0; background-color: ${c.page};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${c.page}; font-family: ${SANS}; padding: 24px 0;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; background-color: ${c.card}; border-radius: 12px; border: 1px solid ${c.border}; padding: 32px;">
      <tr><td style="padding-bottom: 24px; border-bottom: 1px solid ${c.border};">
        <span style="font-family: ${MONO}; font-size: 14px; font-weight: 700; color: ${c.accent}; letter-spacing: 0.05em;">GREENBUILD</span>
        <span style="font-family: ${MONO}; font-size: 11px; color: ${c.muted}; float: right;">${escapeHtml(label)}</span>
      </td></tr>
      ${rows}
      <tr><td style="border-top: 1px solid ${c.border}; padding-top: 20px; font-family: ${MONO}; font-size: 10px; line-height: 14px; color: ${c.muted};">
        greenbuild &bull; one broken server a day
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// emailText is the plain-text part, for clients and filters that read no HTML.
export function emailText({ label, lines }: { label: string; lines: string[] }): string {
  const rule = "=".repeat(61);
  return [rule, `GREENBUILD // ${label}`, rule, "", ...lines, "", "greenbuild | one broken server a day", ""].join("\n");
}
