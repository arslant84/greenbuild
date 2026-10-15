"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useHydrated } from "../../../ui/use-hydrated";

export type OAuthProvider = "github" | "google";

export interface SignIn {
  ageConfirmed: boolean;
  setAgeConfirmed: (confirmed: boolean) => void;
  // The address a link was just sent to: the frame's V3 state.
  sentTo: string | null;
  // Auth.js's or the 16+ rule's error code, shown in the banner.
  error: string | undefined;
  // True until the page hydrates, and while a sign-in is starting: the controls wait for JavaScript.
  pending: boolean;
  withProvider: (provider: OAuthProvider) => Promise<void>;
  requestLink: (email: string) => Promise<void>;
  useAnotherEmail: () => void;
  dismissError: () => void;
}

// useSignIn drives the sign-in screen (task 30b): it remembers a ticked "I am 16 or older" in this
// browser before signing in, then signs in through GitHub or Google, or asks for an email link without
// leaving the screen. A returning player needs no box; the server sends anyone who does back here.
export function useSignIn(callbackUrl: string, initialError: string | undefined): SignIn {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);

  async function begin(): Promise<boolean> {
    setPending(true);
    setError(undefined);
    if (ageConfirmed && !(await rememberAge())) {
      setError("Default");
      setPending(false);
      return false;
    }
    return true;
  }

  async function withProvider(provider: OAuthProvider): Promise<void> {
    if (await begin()) {
      await signIn(provider, { redirectTo: callbackUrl });
    }
  }

  async function requestLink(email: string): Promise<void> {
    if (!(await begin())) {
      return;
    }
    const result = await signIn("email", { email, redirect: false, redirectTo: callbackUrl }).catch(() => null);
    setPending(false);
    if (!result || result.error) {
      setError(result?.error ?? "Default");
      return;
    }
    setSentTo(email);
  }

  const hydrated = useHydrated();
  return { ageConfirmed, setAgeConfirmed, sentTo, error, pending: pending || !hydrated, withProvider, requestLink, useAnotherEmail: () => setSentTo(null), dismissError: () => setError(undefined) };
}

async function rememberAge(): Promise<boolean> {
  const response = await fetch("/api/sign-in/age-confirmation", {
    method: "POST",
    headers: { "content-type": "application/json", "x-greenbuild-request": "1" },
    body: JSON.stringify({ confirmed: true }),
  }).catch(() => null);
  return response?.ok ?? false;
}
