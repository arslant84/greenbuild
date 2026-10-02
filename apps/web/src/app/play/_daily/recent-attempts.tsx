import { ArrowForwardIcon } from "../../../ui/icons";

// Figma › Section - RECENT ATTEMPTS SECTION. The API has no attempt history yet, so the table shows
// its empty state in the row layout of the design.
export function RecentAttempts() {
  return (
    <section className="flex flex-col gap-2 pt-1">
      <div className="flex h-[18px] items-center justify-between px-1">
        <span className="flex items-center gap-1">
          <span className="type-body font-semibold tracking-[0.65px] text-ink-muted uppercase">Recent attempts</span>
          <span className="type-label text-[#bbc9cdcc]">(last 5 days)</span>
        </span>
        <span className="flex items-center gap-1 text-accent-soft" aria-disabled="true">
          <span className="type-label">View all history</span>
          <ArrowForwardIcon width={9} height={9} />
        </span>
      </div>
      <div className="rounded-xl bg-surface-raised shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <div className="flex h-[54px] flex-col justify-center p-3">
          <span className="type-body font-medium text-ink">No attempts yet</span>
          <span className="type-label text-ink-muted">Finished attempts appear here.</span>
        </div>
      </div>
    </section>
  );
}
