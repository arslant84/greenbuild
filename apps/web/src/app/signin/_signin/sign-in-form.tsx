"use client";

import { type FormEvent, useState } from "react";
import { ArrowRightIcon, AtIcon, GitHubIcon, GoogleIcon } from "../../../ui/icons-signin";
import type { OAuthProvider, SignIn } from "./use-sign-in";

const PROVIDER_BUTTON = "flex h-12 w-full items-center justify-center gap-2.5 rounded-lg px-4 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40";

// Figma 7:9957 › V1 Sign In: the OAuth buttons, the 16+ checkbox (not in the frame; owner, 2026-10-15,
// as 18+ in the settings) and the email link form.
export function SignInForm({ signIn, providers }: { signIn: SignIn; providers: Record<OAuthProvider, boolean> }) {
  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <h1 className="mb-1.5 text-xl font-semibold tracking-tight text-ink">Sign in to greenbuild</h1>
        <p className="text-xs text-ink-muted">Free forever for engineers. No ads.</p>
      </div>
      <ProviderButtons signIn={signIn} providers={providers} />
      <label className="mt-4 flex items-center gap-2 text-xs text-ink-muted">
        <input type="checkbox" disabled={signIn.pending} checked={signIn.ageConfirmed} onChange={(event) => signIn.setAgeConfirmed(event.target.checked)} className="size-4 accent-accent" />I am 16 or older
      </label>
      <div className="relative my-5 flex items-center justify-center">
        <span className="absolute inset-x-0 border-t border-line" />
        <span className="relative bg-surface px-3 font-mono text-[11px] text-ink-subtle">or</span>
      </div>
      <EmailLinkForm signIn={signIn} />
    </div>
  );
}

function ProviderButtons({ signIn, providers }: { signIn: SignIn; providers: Record<OAuthProvider, boolean> }) {
  return (
    <div className="flex flex-col gap-3">
      <button type="button" disabled={!providers.github || signIn.pending} onClick={() => void signIn.withProvider("github")} className={`${PROVIDER_BUTTON} relative bg-accent font-semibold text-[#00363e] hover:bg-accent/90`}>
        <span className="absolute -top-2.5 right-2.5 rounded border border-[#005763] bg-canvas px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-accent-soft uppercase">Recommended</span>
        <GitHubIcon className="shrink-0 text-base" />
        <span>Continue with GitHub</span>
      </button>
      <button type="button" disabled={!providers.google || signIn.pending} onClick={() => void signIn.withProvider("google")} className={`${PROVIDER_BUTTON} border border-line bg-surface-raised font-medium text-ink hover:bg-control`}>
        <GoogleIcon className="shrink-0 text-base" />
        <span>Continue with Google</span>
      </button>
    </div>
  );
}

function EmailLinkForm({ signIn }: { signIn: SignIn }) {
  const [email, setEmail] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void signIn.requestLink(email);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="block font-mono text-xs text-ink-muted">
        <span className="mb-1.5 block">Work or personal email</span>
        <span className="relative block">
          <input
            type="email"
            required
            disabled={signIn.pending}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-line bg-surface-raised px-3.5 py-2.5 font-mono text-xs text-ink outline-none placeholder:text-ink-subtle focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <AtIcon className="pointer-events-none absolute top-2.5 right-3 text-base text-ink-subtle" />
        </span>
      </label>
      <button type="submit" disabled={signIn.pending} className="group mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-control bg-surface-raised font-mono text-xs font-medium text-ink transition-all hover:bg-control disabled:opacity-40">
        <span>Send magic link</span>
        <ArrowRightIcon className="text-sm text-ink-subtle transition-transform group-hover:translate-x-0.5" />
      </button>
      <p className="mt-0.5 text-center font-mono text-[11px] text-ink-subtle">Passwordless authentication · One-time sign-in link</p>
    </form>
  );
}
