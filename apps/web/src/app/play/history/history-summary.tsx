import Link from "next/link";
import { type HistoryMode, HISTORY_MODES, type HistoryTotals } from "./history-table";

const MODE_LABELS: Record<HistoryMode, string> = { all: "All", daily: "Daily", catalog: "Catalog" };

// Stitch "Hotfix — Attempt History" › stat cards: attempts, solved and XP of the listed attempts.
export function HistoryStats({ totals }: { totals: HistoryTotals }) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <StatCard label="Attempts" value={String(totals.attempts)} color="text-ink" />
      <StatCard label="Solved" value={String(totals.solved)} color="text-ok" />
      <StatCard label="XP earned" value={`${totals.xp.toLocaleString("en-US")} XP`} color="text-warn" />
    </section>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#3c494c66] bg-surface p-3">
      <span className="type-label tracking-wider text-ink-muted uppercase">{label}</span>
      <span className={`font-mono text-[28px] leading-8 font-bold ${color}`}>{value}</span>
    </div>
  );
}

// Stitch › segmented filter: each mode is a link, so the server renders the chosen one.
export function ModeFilter({ active }: { active: HistoryMode }) {
  return (
    <nav aria-label="Filter by mode" className="inline-flex self-start rounded-lg border border-[#3c494c66] bg-surface p-1 font-mono text-[13px] leading-[18px]">
      {HISTORY_MODES.map((mode) => {
        const isActive = mode === active;
        const colors = isActive ? "border-l border-accent/80 bg-control font-medium text-accent" : "text-ink-muted hover:text-ink";
        return (
          <Link key={mode} href={mode === "all" ? "/play/history" : `/play/history?mode=${mode}`} aria-current={isActive ? "page" : undefined} className={`rounded px-4 py-1.5 ${colors}`}>
            {MODE_LABELS[mode]}
          </Link>
        );
      })}
    </nav>
  );
}
