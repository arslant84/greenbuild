"use client";

import { attemptResponseSchema } from "@greenbuild/shared";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useSubmitShortcut } from "../../../ui/use-shortcut";
import { failureMessage } from "./start-messages";

// useStartAttempt creates the attempt and opens its sandbox screen, which waits for the sandbox.
function useStartAttempt(challengeSlug: string) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = useCallback(async (): Promise<void> => {
    setStarting(true);
    setError(null);
    const response = await fetch("/api/attempts", {
      method: "POST",
      headers: { "content-type": "application/json", "x-greenbuild-request": "1" },
      body: JSON.stringify({ challenge_slug: challengeSlug }),
    }).catch(() => null);
    const attempt = response?.ok ? attemptResponseSchema.safeParse(await response.json()) : null;
    if (attempt?.success) {
      router.push(`/play/${attempt.data.id}`);
      return;
    }
    setError(await failureMessage(response));
    setStarting(false);
  }, [challengeSlug, router]);
  return { start, starting, error };
}

// Figma › Big CTA Button.
export function StartButton({ challengeSlug }: { challengeSlug: string }) {
  const { start, starting, error } = useStartAttempt(challengeSlug);
  useSubmitShortcut(() => void start(), !starting);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void start()}
        disabled={starting}
        className="flex h-14 items-center justify-center gap-2 rounded-lg bg-accent text-on-accent shadow-[0_4px_6px_-4px_rgba(8,51,69,0.5),0_10px_15px_-3px_rgba(8,51,69,0.5)] disabled:opacity-70"
      >
        <span className="font-mono text-[13px] leading-[18px] font-semibold tracking-[-0.32px]">&gt;_</span>
        <span className="text-[15px] leading-[22px] font-bold">{starting ? "Starting…" : "Start Challenge"}</span>
        <span className="type-label ml-2 rounded bg-black/20 px-1.5 py-0.5">⌘ + ↵</span>
      </button>
      {error && (
        <p role="alert" className="type-label text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
