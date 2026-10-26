import Link from "next/link";
import { ArrowForwardIcon } from "../../../../../ui/icons";
import { AnalysisIcon, ArrowBackSmallIcon, CodeIcon, ExpandSmallIcon, FastForwardIcon } from "../../../../../ui/icons-debrief";

// Figma › Root Cause Analysis & Postmortem Card. Challenges do not publish their write-up through the
// API yet, so the card says so; the reference solution stays closed.
export function Postmortem() {
  return (
    <section className="mb-5 flex flex-col gap-3 rounded-xl bg-surface-raised p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <span className="flex items-center gap-1 text-accent">
        <AnalysisIcon />
        <h2 className="font-mono text-[11px] leading-[14px] font-semibold tracking-[0.55px] text-ink-muted uppercase">Root cause analysis &amp; postmortem</h2>
      </span>
      <p className="type-body leading-[21px] text-ink">The write-up for this challenge is not published yet.</p>
      <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 opacity-60" aria-disabled="true">
        <span className="flex items-center gap-2 text-accent">
          <CodeIcon />
          <span className="type-label text-ink-muted">Show reference patch &amp; system commands</span>
        </span>
        <span className="flex items-center gap-1 text-ink-subtle">
          <span className="type-label">Expand</span>
          <ExpandSmallIcon />
        </span>
      </div>
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
        <span className="flex items-center gap-1 text-accent-soft opacity-60" aria-disabled="true">
          <span className="type-label">Play Catalog</span>
          <ArrowForwardIcon width={11} height={11} />
        </span>
      </div>
      <Link href="/play" className="flex items-center gap-1 text-ink-subtle">
        <ArrowBackSmallIcon />
        <span className="type-label">RETURN TO OPERATIONS CONSOLE</span>
      </Link>
    </section>
  );
}
