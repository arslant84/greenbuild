"use client";

import Link from "next/link";
import { AlertIcon, CloseIcon, InfoIcon, MailIcon } from "../../../ui/icons-signin";
import { signInBanner } from "./sign-in-banner";
import { SignInForm } from "./sign-in-form";
import { type OAuthProvider, type SignIn, useSignIn } from "./use-sign-in";

// The link's lifetime as the email itself states it (server/email-sign-in.ts).
const LINK_LIFETIME = "24 hours";

// Figma 7:9957: the centered card with its states, V1 sign in, V3 link sent and V4's error banner.
export function SignInCard({ callbackUrl, error, providers }: { callbackUrl: string; error: string | undefined; providers: Record<OAuthProvider, boolean> }) {
  const signIn = useSignIn(callbackUrl, error);
  const banner = signInBanner(signIn.error);

  return (
    <div className="relative mx-auto my-8 w-full max-w-[420px]">
      {banner && (
        <div role="alert" className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-[#93000a] bg-[#93000a]/40 p-3.5 text-xs text-[#ffdad6] shadow-sm">
          <span className="flex items-start gap-2.5">
            <AlertIcon className="mt-0.5 shrink-0 text-base text-danger" />
            <span className="leading-relaxed">
              <span className="font-semibold text-danger">{banner.title}</span> {banner.text}
            </span>
          </span>
          <button type="button" aria-label="Dismiss error" onClick={signIn.dismissError} className="shrink-0 p-0.5 text-danger hover:text-[#ffdad6]">
            <CloseIcon className="text-base" />
          </button>
        </div>
      )}
      <div className="relative rounded-xl border border-line bg-surface p-7">{signIn.sentTo ? <LinkSent signIn={signIn} email={signIn.sentTo} /> : <SignInForm signIn={signIn} providers={providers} />}</div>
      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-ink-subtle">
          <span className="size-1.5 rounded-full bg-[#a78bfa]" />
          Are you hiring? Company sign-in opens later
        </span>
        <p className="max-w-xs text-[11px] leading-normal text-ink-muted">
          By authenticating, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-ink">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-ink">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

// Figma 7:9957 › V3 Magic Link Sent.
function LinkSent({ signIn, email }: { signIn: SignIn; email: string }) {
  return (
    <div className="flex flex-col items-center py-3 text-center">
      <span className="mb-5 flex size-12 items-center justify-center rounded-full border border-accent/30 bg-[#004e5a]/80 text-2xl text-accent shadow-[0_0_24px_rgba(34,211,238,0.25)]">
        <MailIcon />
      </span>
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-ink">Check your email</h1>
      <p className="mb-6 text-xs leading-relaxed text-ink-muted">
        We sent a sign-in link to <br />
        <span className="font-mono font-medium text-ink">{email}</span>
      </p>
      <p className="mb-6 flex w-full items-start gap-2.5 rounded-lg border border-line bg-surface-raised p-3.5 text-left font-mono text-xs text-ink-muted">
        <InfoIcon className="mt-0.5 shrink-0 text-base text-accent" />
        <span>The link works once, for {LINK_LIFETIME}. Check spam or junk folders if it does not arrive.</span>
      </p>
      <div className="flex w-full flex-col gap-2.5 text-xs">
        <button type="button" disabled={signIn.pending} onClick={() => void signIn.requestLink(email)} className="w-full rounded-lg border border-line bg-surface-raised py-2.5 font-mono text-ink transition-colors hover:bg-control">
          Didn&apos;t receive it? Resend link
        </button>
        <button type="button" onClick={signIn.useAnotherEmail} className="w-full py-2 text-ink-subtle transition-colors hover:text-ink">
          ← Use a different email
        </button>
      </div>
    </div>
  );
}
