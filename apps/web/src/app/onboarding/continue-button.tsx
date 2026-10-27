"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ContinueArrowIcon } from "../../ui/icons-onboarding";

// Steps 2–5 have no Figma frames yet, so the Welcome step leads straight to the Daily screen (owner, 2026-10-08).
export const AFTER_ONBOARDING = "/play";

// Figma › Primary CTA and Shortcut hint: "Let's go", also on Enter.
export function ContinueButton() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
        router.push(AFTER_ONBOARDING);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return (
    <div className="flex items-center gap-3 max-lg:order-last lg:pt-6">
      <Link href={AFTER_ONBOARDING} className="flex h-12 items-center justify-center gap-2 rounded-lg bg-accent px-8 max-lg:flex-1 text-[13px] leading-[18px] font-semibold text-[#00363e]">
        Let&apos;s go
        <ContinueArrowIcon />
      </Link>
      <span className="hidden items-center gap-1.5 lg:flex">
        <span className="type-label type-term rounded bg-surface-raised px-1.5 py-0.5 text-ink">↵ Enter</span>
        <span className="type-label text-ink-subtle">to continue</span>
      </span>
    </div>
  );
}
