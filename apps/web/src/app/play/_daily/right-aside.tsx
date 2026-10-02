import { ArrowForwardIcon, ExpandMoreIcon } from "../../../ui/icons";

const CARD = "rounded-xl bg-surface-raised shadow-[0_1px_2px_rgba(0,0,0,0.05)]";

// Figma › Aside - RIGHT SIDEBAR (280px). Results history, leaderboards and system telemetry arrive
// with their features; until then the cards keep their layout and show empty values.
export function RightAside() {
  return (
    <aside className="flex w-[280px] shrink-0 flex-col gap-5 self-start bg-[#0e0e0f80] p-3">
      <YesterdaysResult />
      <Leaderboard />
      <div className="flex items-center justify-between rounded-lg bg-canvas p-2">
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-line" />
          <span className="type-label text-ink-muted">Sandbox engine</span>
        </span>
        <span className="type-label text-ink-muted">— latency</span>
      </div>
    </aside>
  );
}

function YesterdaysResult() {
  return (
    <section className={CARD}>
      <div className="flex items-center justify-between p-3">
        <span className="flex items-center gap-2">
          <span className="type-body font-semibold text-ink">Yesterday&apos;s Result</span>
          <span className="type-label rounded bg-line px-1.5 py-0.5 text-ink-muted">#—</span>
        </span>
        <ExpandMoreIcon className="text-ink-muted" />
      </div>
      <div className="flex flex-col gap-2 px-3 pb-3">
        <div className="flex justify-center gap-1 rounded-lg bg-canvas p-2">
          <Stat label="SOLVE TIME" value="—" />
          <Stat label="EARNED" value="—" />
        </div>
        <div className="flex flex-col gap-[3.25px] rounded-lg bg-canvas p-2">
          <span className="type-label text-ink-muted">ROOT CAUSE</span>
          <span className="type-term text-[10px] leading-[13px] tracking-[0.2px] text-ink">—</span>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex w-[106px] flex-col">
      <span className="type-label text-ink-muted">{label}</span>
      <span className="font-mono text-[13px] leading-[18px] font-semibold text-ink">{value}</span>
      <span className="font-mono text-[9px] leading-[18px] text-ink-muted">&nbsp;</span>
    </span>
  );
}

function Leaderboard() {
  return (
    <section className={`${CARD} flex flex-col gap-3 p-3`}>
      <div className="flex h-[18px] items-center justify-between">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-ok" />
          <span className="type-body font-semibold text-ink">Top 5 This Week</span>
        </span>
        <span className="type-label font-medium text-ink-muted">WK —</span>
      </div>
      <div className="rounded px-1 py-1.5">
        <span className="type-label text-ink-muted">No rankings yet</span>
      </div>
      <div className="flex items-center justify-between pt-1 text-ink-muted" aria-disabled="true">
        <span className="type-label">Global ladder</span>
        <ArrowForwardIcon width={9} height={9} />
      </div>
    </section>
  );
}
