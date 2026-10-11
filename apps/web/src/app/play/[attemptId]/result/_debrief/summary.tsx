import { formatClock } from "../../../../../ui/format";
import { BoltIcon, FlameIcon } from "../../../../../ui/icons";
import { KeyIcon, TrendingUpIcon } from "../../../../../ui/icons-debrief";
import { xpAmount } from "../../../xp-view";
import { type Outcome, TONE_BG, TONE_TEXT } from "./outcome";

const MS_PER_SECOND = 1_000;

export function formatDuration(durationMs: number | null): string {
  return durationMs === null ? "—" : formatClock(durationMs / MS_PER_SECOND);
}

interface SummaryProps {
  title: string;
  outcome: Outcome;
  durationMs: number | null;
  // Null until the worker credits the attempt (task 42b).
  xpEarned: number | null;
  // The player's current streak (task 44), or null when the profile could not be read.
  streak: number | null;
}

// Figma › Breadcrumb & Challenge Meta, Hero Result Section and Stats Bento Row. XP earned comes from
// the result (task 42b) and the streak from the profile (task 44); the rating card shows empty values
// until it has a task.
export function Summary({ title, outcome, durationMs, xpEarned, streak }: SummaryProps) {
  return (
    <>
      <section className="flex flex-col gap-1 pb-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 rounded bg-control px-2 py-1">
            <span className={`size-2 rounded-full ${TONE_BG[outcome.tone]}`} />
            <span className={`font-mono text-[11px] leading-[14px] font-medium tracking-[0.44px] ${TONE_TEXT[outcome.tone]}`}>DAILY · {outcome.tag}</span>
          </span>
          <span className="flex items-center gap-1 text-ink-muted">
            <KeyIcon />
            <span className="type-label">SEED: hidden</span>
          </span>
        </div>
        <h1 className="pt-1 text-[32px] leading-10 font-semibold tracking-[-0.8px] text-ink">{title}</h1>
      </section>
      <section className="mb-5 flex items-start justify-between rounded-xl bg-surface-raised p-5 shadow-[0_8px_10px_-6px_rgba(0,0,0,0.1),0_20px_25px_-5px_rgba(0,0,0,0.1)]">
        <span className="flex flex-col gap-1 pt-7">
          <span className="type-label tracking-[0.5px] text-ink-muted uppercase">Incident outcome</span>
          <span className={`text-[64px] leading-[64px] font-bold tracking-[-1.6px] ${TONE_TEXT[outcome.tone]}`}>{outcome.label}</span>
        </span>
        <span className="flex flex-col items-end">
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-[38px] leading-[48px] font-semibold text-ink">{formatDuration(durationMs)}</span>
            <span className="type-label text-ink-muted">DURATION</span>
          </span>
          <span className="type-label pt-0.5 text-ink-subtle">vs — median</span>
        </span>
      </section>
      <section className="mb-5 flex gap-2">
        <Stat label="XP EARNED" value={xpAmount(xpEarned)} note="—" icon={<BoltIcon className="text-warn" />} tone="text-warn" />
        <Stat label="RATING CHANGE" value="—" note="—" icon={<TrendingUpIcon className="text-ok" />} tone="text-accent" />
        <Stat label="ACTIVE STREAK" value={xpAmount(streak)} note="—" icon={<FlameIcon width={11} height={13} className="text-warn" />} tone="text-ink" />
      </section>
    </>
  );
}

interface StatProps {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  tone: string;
}

function Stat({ label, value, note, icon, tone }: StatProps) {
  return (
    <span className="flex h-[97px] flex-1 flex-col justify-between rounded-xl bg-surface-raised p-3">
      <span className="flex items-center justify-between pb-1">
        <span className="type-label tracking-[0.5px] text-ink-muted uppercase">{label}</span>
        {icon}
      </span>
      <span className={`py-1 font-mono text-[32px] leading-8 font-semibold ${tone}`}>{value}</span>
      <span className="type-label pt-1 text-ink-subtle">{note}</span>
    </span>
  );
}
