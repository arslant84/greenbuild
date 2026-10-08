import Link from "next/link";
import { ClockIcon, PlayCircleIcon } from "../../ui/icons-landing";
import { HeroTerminal } from "./hero-terminal";

// Figma (Landing) › Section - HERO SECTION. Wording follows the frame except where it was not true for
// greenbuild (owner, 2026-10-08): scenarios take up to 15 minutes and there is no daily reset yet.
export function Hero() {
  return (
    <section className="grid grid-cols-2 gap-6 py-8">
      <div className="flex flex-col justify-center">
        <span className="mb-5 flex w-fit items-center gap-2 rounded bg-surface px-3 py-1.5">
          <span className="size-2 rounded-full bg-ok" />
          <span className="font-mono text-[11px] leading-[14px] font-medium tracking-[0.28px] text-ink-muted">[GREENBUILD] LIVE SANDBOX · 15:00 LIMIT</span>
        </span>
        <h1 className="pb-3 text-[32px] leading-10 font-bold tracking-[-0.8px] text-ink">
          Fix the broken system.
          <br />
          Every single day.
        </h1>
        <p className="w-[512px] pb-5 text-[15px] leading-6 text-ink-muted">
          Up to 15-minute DevOps scenarios modeled on real production incidents. Triage failures, patch configs, build your verifiable rating.
        </p>
        <div className="flex items-center gap-3 pb-5">
          <Link href="/onboarding" className="flex h-[42px] items-center rounded-lg bg-accent px-5 text-[13px] leading-[18px] font-semibold text-[#00363e] shadow-[0_4px_6px_-4px_rgba(8,51,69,0.5)]">
            Start today&apos;s challenge — free
          </Link>
          <a href="#how-it-works" className="flex h-[42px] items-center gap-1 rounded-lg bg-surface px-3 text-[13px] leading-[18px] font-medium text-ink-muted">
            <PlayCircleIcon />
            See how it works
          </a>
        </div>
        <span className="type-label flex items-center gap-2 text-ink-subtle">
          <ClockIcon />
          <span>Linux ephemeral sandboxes</span>
          <span>·</span>
          <span>Zero local setup</span>
        </span>
      </div>
      <HeroTerminal />
    </section>
  );
}
