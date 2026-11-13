import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { ArrowForwardIcon, CancelIcon, CheckCircleIcon, TerminalIcon, TimerIcon } from "../../../ui/icons";
import type { Outcome } from "../_daily/history-view";
import type { HistoryTableRow } from "./history-table";

const COLUMNS = ["Outcome", "Date", "Incident ID", "Challenge", "Mode", "Status", "Time", "Hints", "XP"];

const OUTCOME_COLOR: Record<Outcome, string> = { PASSED: "text-ok", FAILED: "text-danger", EXPIRED: "text-danger", ABANDONED: "text-ink-muted" };

const STATUS_BADGE: Record<Outcome, string> = {
  PASSED: "border-ok/30 bg-ok/10 text-ok",
  FAILED: "border-danger/30 bg-danger/10 text-danger",
  EXPIRED: "border-danger/30 bg-danger/10 text-danger",
  ABANDONED: "border-[#3c494c] bg-control text-ink-muted",
};

const OUTCOME_ICON: Record<Outcome, ComponentType<SVGProps<SVGSVGElement>>> = { PASSED: CheckCircleIcon, FAILED: CancelIcon, EXPIRED: TimerIcon, ABANDONED: AbandonedIcon };

const CELL = "px-4 py-3.5 whitespace-nowrap";

// Stitch "Hotfix — Attempt History" › table card: one row per attempt, each opening its debrief.
export function HistoryTable({ rows }: { rows: HistoryTableRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#3c494c66] bg-canvas">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="type-label border-b border-[#3c494c4d] bg-surface/60 tracking-wider text-ink-muted uppercase">
              {COLUMNS.map((column) => (
                <th key={column} className="px-4 py-3 font-normal">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3c494c33]">
            {rows.map((row) => (
              <AttemptRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// The challenge's link covers the whole row, so a click anywhere opens the debrief.
function AttemptRow({ row }: { row: HistoryTableRow }) {
  const Icon = OUTCOME_ICON[row.outcome];
  const isDaily = row.mode === "DAILY";
  return (
    <tr className="relative type-label text-ink-muted hover:bg-control/40">
      <td className={CELL}>
        <span className={`inline-flex items-center gap-1.5 font-medium ${OUTCOME_COLOR[row.outcome]}`}>
          <Icon width={15} height={15} />
          {row.outcome}
        </span>
      </td>
      <td className={CELL}>{row.day}</td>
      <td className={CELL}>#{row.incident}</td>
      <td className="px-4 py-3.5">
        <Link href={`/play/${row.id}/result`} className="type-body block font-semibold text-ink after:absolute after:inset-0">
          {row.title}
        </Link>
        <span>sandbox-env // {row.slug}</span>
      </td>
      <td className={CELL}>
        <span className={`rounded border px-2 py-0.5 font-medium ${isDaily ? "border-accent/30 bg-accent/10 text-accent" : "border-[#3c494c] bg-control text-ink-muted"}`}>{row.mode}</span>
      </td>
      <td className={CELL}>
        <span className={`rounded border px-2 py-0.5 font-medium ${STATUS_BADGE[row.outcome]}`}>{row.outcome}</span>
      </td>
      <td className={CELL}>{row.time}</td>
      <td className={CELL}>{row.hints}</td>
      <td className={`${CELL} font-medium text-warn`}>{row.xp}</td>
    </tr>
  );
}

// Stitch › empty state: no finished attempts (in this mode) yet.
export function EmptyHistory() {
  return (
    <section className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#3c494c66] bg-surface/40 p-8 text-center">
      <span className="mb-2 flex size-12 items-center justify-center rounded-full border border-[#3c494c4d] bg-control text-ink-muted">
        <TerminalIcon width={24} height={24} />
      </span>
      <h2 className="text-[16px] leading-6 font-semibold text-ink">No attempts yet</h2>
      <p className="type-body mt-1 text-ink-muted">Finished attempts appear here.</p>
      <Link href="/play" className="type-body mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 font-semibold text-on-accent hover:bg-[#2fd9f4]">
        Play today&apos;s daily
        <ArrowForwardIcon width={12} height={12} />
      </Link>
    </section>
  );
}

// The frame's abandoned outcome (Material Symbols "do_not_disturb_on"), drawn as a minus in a circle.
function AbandonedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={15} height={15} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" {...props}>
      <circle cx={7.5} cy={7.5} r={6.75} />
      <path d="M4.5 7.5H10.5" />
    </svg>
  );
}
