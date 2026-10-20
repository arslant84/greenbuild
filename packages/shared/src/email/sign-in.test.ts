import { describe, expect, it } from "vitest";
import { escapeHtml } from "./layout.js";
import { signInEmail } from "./sign-in.js";

const URL_WITH_QUERY = "https://greenbuild.dev/api/auth/callback/email?token=abc&email=ada%40example.com";

describe("signInEmail", () => {
  it("links to the sign-in URL in the button and the fallback box, with the link's real lifetime", () => {
    const email = signInEmail({ url: URL_WITH_QUERY, lifetimeHours: 24 });

    expect(email.subject).toBe("Sign in to greenbuild");
    expect(email.html.split(`href="${escapeHtml(URL_WITH_QUERY)}"`)).toHaveLength(2);
    expect(email.html).toContain(">https://greenbuild.dev/api/auth/callback/email?token=abc&amp;email=ada%40example.com<");
    expect(email.html).toContain("24 hours");
    expect(email.html).not.toMatch(/hotfix|15 minutes/i);
  });

  it("carries the same link in the plain-text part", () => {
    const email = signInEmail({ url: URL_WITH_QUERY, lifetimeHours: 24 });

    expect(email.text).toContain(`\n${URL_WITH_QUERY}\n`);
    expect(email.text).toContain("for 24 hours");
  });

  it("escapes what it is given, so a crafted link cannot add markup", () => {
    const email = signInEmail({ url: 'https://x.dev/"><script>alert(1)</script>', lifetimeHours: 24 });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&quot;&gt;&lt;script&gt;");
  });
});
