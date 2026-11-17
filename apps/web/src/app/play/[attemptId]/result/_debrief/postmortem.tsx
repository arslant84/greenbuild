import Link from "next/link";
import { ArrowForwardIcon } from "../../../../../ui/icons";
import { AnalysisIcon, ArrowBackSmallIcon, FastForwardIcon } from "../../../../../ui/icons-debrief";

// Figma › Root Cause Analysis & Postmortem Card. Challenges do not publish their write-up through the
// API yet, so the card says so. The reference solution is never shown to players (it stays in CI), so the
// frame's "Show reference patch" is hidden (deviation 37).
export function Postmortem() {
  return (
    <section className="mb-5 flex flex-col gap-3 rounded-xl bg-surface-raised p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <span className="flex items-center gap-1 text-accent">
        <AnalysisIcon />
        <h2 className="font-mono text-[11px] leading-[14px] font-semibold tracking-[0.55px] text-ink-muted uppercase">Root cause analysis &amp; postmortem</h2>
      </span>
      <p className="type-body leading-[21px] text-ink">The write-up for this challenge is not published yet.</p>
    </section>
  );
}

// Figma › Bottom Navigation Actions. The daily rotation and the catalog arrive later.
export function NextActions() {
  return (
    <section className="flex flex-col items-center gap-3 pt-2 pb-8">
      <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-raised px-5 py-3 lg:h-12 lg:py-0 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]">
        <span className="flex items-center gap-1 text-accent">
          <FastForwardIcon />
          <span className="font-mono text-[13px] leading-[18px] font-semibold text-ink">Next challenge unlocks in --h --m</span>
        </span>
        <Link href="/challenges" className="flex items-center gap-1 text-accent-soft">
          <span className="type-label">Play Catalog</span>
          <ArrowForwardIcon width={11} height={11} />
        </Link>
      </div>
      <Link href="/play" className="flex items-center gap-1 text-ink-subtle">
        <ArrowBackSmallIcon />
        <span className="type-label">RETURN TO OPERATIONS CONSOLE</span>
      </Link>
    </section>
  );
}
