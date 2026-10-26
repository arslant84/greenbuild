import type { Metadata } from "next";
import Link from "next/link";
import { loadAuthConfig } from "../../config/auth";
import { ProofColumn } from "./_signin/proof-column";
import { SignInCard } from "./_signin/sign-in-card";
import { LogoMark } from "../../ui/logo-mark";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in · greenbuild", robots: { index: false } };

// Where a player lands after signing in, unless Auth.js brought them here from another page.
const AFTER_SIGN_IN = "/play";

interface SignInPageProps {
  // `code` carries the seconds left after too many link requests (task 30b-4).
  searchParams: Promise<{ error?: string | string[]; code?: string | string[]; callbackUrl?: string | string[] }>;
}

// Figma "Hotfix — Authentication Suite" (7:9957), laid out from the owner's Stitch copy (task 30b): sign in
// (V1), link sent (V3) and the OAuth error (V4). Sign-up is the same flow, so V2 is not built; company
// sign-in (V6) waits for Stage 1.5. The frame's state simulator bar is a design control.
export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const config = loadAuthConfig();
  const providers = { github: Boolean(config?.github), google: Boolean(config?.google) };
  return (
    <main className="grid min-h-screen min-w-[1280px] grid-cols-12 bg-canvas text-ink">
      <section className="relative col-span-7 flex min-h-screen flex-col justify-between bg-canvas px-16 py-10">
        <div className="flex w-full items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 font-mono text-sm tracking-tight text-ink">
            <LogoMark />
            <span className="font-bold text-accent">&gt;_</span>
            <span className="font-semibold tracking-wide">greenbuild</span>
            <span className="rounded border border-[#005763] bg-[#004e5a]/40 px-1.5 py-0.5 font-mono text-[10px] text-accent-soft">beta</span>
          </Link>
          <span className="flex items-center gap-2 font-mono text-xs text-ink-subtle">
            <span className="size-1.5 rounded-full bg-ok" />— // —
          </span>
        </div>
        <SignInCard callbackUrl={safeCallbackUrl(first(params.callbackUrl))} error={first(params.error)} retryAfterSec={Number(first(params.code)) || null} providers={providers} />
        <div className="flex w-full items-center justify-between border-t border-surface-raised pt-4 font-mono text-[11px] text-ink-muted">
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-accent" />
            Challenge — Active: <span className="text-ink">—</span>
          </span>
          <span>
            Median solve: <span className="text-ink">—</span>
          </span>
        </div>
      </section>
      <ProofColumn />
    </main>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Only a path on this site, so the screen cannot be used to send players elsewhere.
function safeCallbackUrl(url: string | undefined): string {
  if (!url) {
    return AFTER_SIGN_IN;
  }
  try {
    const parsed = new URL(url, "http://greenbuild.local");
    return parsed.origin === "http://greenbuild.local" ? `${parsed.pathname}${parsed.search}` : AFTER_SIGN_IN;
  } catch {
    return AFTER_SIGN_IN;
  }
}
