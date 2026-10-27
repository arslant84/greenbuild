import Link from "next/link";
import { ViewAllArrowIcon } from "../../ui/icons-landing";

const COLUMNS = [
  { label: "Rank", width: "w-[77px]", align: "" },
  { label: "Engineer", width: "min-w-[489px] flex-1", align: "" },
  { label: "Today's solve time", width: "w-[196px]", align: "" },
  { label: "Active streak", width: "w-[151px]", align: "" },
  { label: "Glicko-2 rating", width: "flex-1", align: "text-right" },
];

// Figma (Landing) › Section - WEEKLY LEADERBOARD PREVIEW. The table shows its empty state instead of the
// frame's sample players; "View all ranked engineers" opens the leaderboard.
export function LeaderboardPreview() {
  return (
    <section className="flex flex-col gap-5 py-8">
      <div className="flex flex-col items-start gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1.25 pt-0.75">
          <span className="font-mono text-[11px] leading-3.5 font-semibold tracking-[1.1px] text-accent-soft uppercase">Global SRE standings</span>
          <h2 className="text-2xl leading-7.5 font-bold tracking-[-0.6px] text-ink">Weekly Leaderboard</h2>
        </div>
        <Link href="/leaderboard" className="flex items-center gap-1 text-[13px] leading-4.5 font-medium text-accent-soft">
          View all ranked engineers
          <ViewAllArrowIcon />
        </Link>
      </div>
      <div className="overflow-hidden rounded-xl bg-canvas shadow-[0_8px_10px_-6px_rgba(0,0,0,0.1),0_20px_25px_-5px_rgba(0,0,0,0.1)]">
        <div className="hidden bg-surface-raised lg:flex">
          {COLUMNS.map((column) => (
            <span key={column.label} className={`type-label p-3 font-semibold tracking-[0.5px] text-ink-subtle uppercase ${column.width} ${column.align}`}>
              {column.label}
            </span>
          ))}
        </div>
        <p className="type-body px-3 py-3.5 text-center text-ink-subtle">No rankings yet</p>
      </div>
    </section>
  );
}
