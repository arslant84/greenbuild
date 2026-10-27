import type { Metadata } from "next";
import { loadAuthConfig } from "../../config/auth";
import { ProofColumn } from "./_signin/proof-column";
import { SignInCard } from "./_signin/sign-in-card";
import { Brand } from "../../ui/brand";

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
    // Below 1024 px the Stitch phone screen "Greenbuild — Sign In (Phone)": one column, the proof below (task 56).
    <main data-responsive className="grid min-h-screen grid-cols-1 bg-canvas text-ink lg:min-w-[1280px] lg:grid-cols-12">
      <section className="relative flex flex-col justify-between gap-6 bg-canvas px-4 py-6 lg:col-span-7 lg:min-h-screen lg:gap-0 lg:px-16 lg:py-10">
        <div className="flex w-full items-center justify-between">
          <span className="flex items-center gap-2">
            <Brand />
            <span className="rounded border border-[#005763] bg-[#004e5a]/40 px-1.5 py-0.5 font-mono text-[10px] text-accent-soft">beta</span>
          </span>
          <span className="flex items-center gap-2 font-mono text-xs text-ink-subtle">
            <span className="size-1.5 rounded-full bg-ok" />— // —
          </span>
        </div>
        <SignInCard callbackUrl={safeCallbackUrl(first(params.callbackUrl))} error={first(params.error)} retryAfterSec={Number(first(params.code)) || null} providers={providers} />
        <div className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-surface-raised pt-4 font-mono text-[11px] text-ink-muted">
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
