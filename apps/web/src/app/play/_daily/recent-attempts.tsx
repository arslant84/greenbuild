import Link from "next/link";
import { ArrowForwardIcon, CancelIcon, CheckCircleIcon } from "../../../ui/icons";
import type { HistoryRow, Outcome } from "./history-view";

const BADGE: Record<Outcome, string> = {
  PASSED: "bg-ok/15 text-ok",
  FAILED: "bg-[#93000a33] text-danger",
  EXPIRED: "bg-[#93000a33] text-danger",
  ABANDONED: "bg-control text-ink-muted",
};

// Figma › Section - RECENT ATTEMPTS SECTION: the player's attempts of the last five days, each opening its
// debrief. There is no history screen yet, so View all history does not navigate.
export function RecentAttempts({ rows }: { rows: HistoryRow[] }) {
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
      <div className="overflow-hidden rounded-xl bg-surface-raised shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        {rows.length > 0 ? (
          <ol>
            {rows.map((row) => (
              <AttemptRow key={row.id} row={row} />
            ))}
          </ol>
        ) : (
          <div className="flex h-[54px] flex-col justify-center p-3">
            <span className="type-body font-medium text-ink">No attempts yet</span>
            <span className="type-label text-ink-muted">Finished attempts appear here.</span>
          </div>
        )}
      </div>
    </section>
  );
}

// Stitch "Hotfix — Daily Challenge" › Attempts Table row: outcome icon, day and incident, title and the
// sandbox, then the outcome, the time and the XP earned.
function AttemptRow({ row }: { row: HistoryRow }) {
  return (
    <li className="border-t border-[#2a2a2b66] first:border-t-0">
      <Link href={`/play/${row.id}/result`} className="flex flex-col gap-2 p-3 hover:bg-control sm:flex-row sm:items-center sm:justify-between">
        <span className="flex min-w-0 items-center gap-3">
          {row.outcome === "PASSED" ? <CheckCircleIcon className="shrink-0 text-ok" /> : <CancelIcon className="shrink-0 text-danger" />}
          <span className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 type-label text-ink-muted">
                {row.day} #{row.incident}
              </span>
              <span className="text-ink-muted/40">·</span>
              <span className="truncate type-body font-medium text-ink">{row.title}</span>
            </span>
            <span className="truncate type-label text-ink-muted">sandbox-env // {row.slug}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-5 pl-8 sm:pl-0">
          <span className={`rounded px-2 py-0.5 type-label font-medium ${BADGE[row.outcome]}`}>{row.outcome}</span>
          <span className="type-label text-ink-muted">{row.time}</span>
          <span className="min-w-16 text-right type-label font-semibold text-warn">{row.xp}</span>
        </span>
      </Link>
    </li>
  );
}
