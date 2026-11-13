import type { AttemptHistoryItem, LeaderboardResponse } from "@greenbuild/shared";
import Link from "next/link";
import { ArrowForwardIcon, ExpandMoreIcon } from "../../../ui/icons";
import { incidentId } from "../../../ui/incident";
import { formatScore } from "../../leaderboard/_board/board-view";
import { solveTime, xpEarned } from "./history-view";
import { topFiveName } from "./top-five";

const CARD = "rounded-xl bg-surface-raised shadow-[0_1px_2px_rgba(0,0,0,0.05)]";

interface RightAsideProps {
  // The weekly XP board's first five, or null when it could not be read; week is its label ("WK 46").
  topFive: LeaderboardResponse | null;
  week: string;
  // The player's attempt at yesterday's daily challenge, or null when they made none.
  yesterday: AttemptHistoryItem | null;
}

// Figma › Aside - RIGHT SIDEBAR (280px). Yesterday's Result reads the player's history and Top 5 This Week
// the weekly board; system telemetry arrives with its feature, so that card shows empty values.
export function RightAside({ topFive, week, yesterday }: RightAsideProps) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-5 self-start bg-[#0e0e0f80] px-4 py-3 lg:w-[280px] lg:px-3">
      <YesterdaysResult attempt={yesterday} />
      <Leaderboard board={topFive} week={week} />
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

// Stitch › Yesterday's Result: the incident, the solve time and the XP earned with the hints used. The
// percentile and the root cause have no data yet (write-ups are not published), so they stay empty.
function YesterdaysResult({ attempt }: { attempt: AttemptHistoryItem | null }) {
  const time = attempt ? (attempt.status === "solved" ? solveTime(attempt.duration_ms) : attempt.status.toUpperCase()) : "—";
  const hints = attempt ? `${attempt.hints_used} ${attempt.hints_used === 1 ? "hint" : "hints"} used` : null;
  return (
    <section className={CARD}>
      <div className="flex items-center justify-between p-3">
        <span className="flex items-center gap-2">
          <span className="type-body font-semibold text-ink">Yesterday&apos;s Result</span>
          <span className="type-label rounded bg-line px-1.5 py-0.5 text-ink-muted">#{attempt ? incidentId(attempt.id) : "—"}</span>
        </span>
        <ExpandMoreIcon className="text-ink-muted" />
      </div>
      <div className="flex flex-col gap-2 px-3 pb-3">
        <div className="flex justify-center gap-1 rounded-lg bg-canvas p-2">
          <Stat label="SOLVE TIME" value={time} />
          <Stat label="EARNED" value={attempt ? xpEarned(attempt.xp_earned) : "—"} note={hints} />
        </div>
        <div className="flex flex-col gap-[3.25px] rounded-lg bg-canvas p-2">
          <span className="type-label text-ink-muted">ROOT CAUSE</span>
          <span className="type-term text-[10px] leading-[13px] tracking-[0.2px] text-ink">—</span>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, note = null }: { label: string; value: string; note?: string | null }) {
  return (
    <span className="flex w-[106px] flex-col">
      <span className="type-label text-ink-muted">{label}</span>
      <span className="font-mono text-[13px] leading-[18px] font-semibold text-ink">{value}</span>
      <span className="font-mono text-[9px] leading-[18px] text-ink-muted">{note ?? "\u00a0"}</span>
    </span>
  );
}

function Leaderboard({ board, week }: { board: LeaderboardResponse | null; week: string }) {
  const entries = board?.entries ?? [];
  return (
    <section className={`${CARD} flex flex-col gap-3 p-3`}>
      <div className="flex h-[18px] items-center justify-between">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-ok" />
          <span className="type-body font-semibold text-ink">Top 5 This Week</span>
        </span>
        <span className="type-label font-medium text-ink-muted">{week}</span>
      </div>
      {entries.length > 0 ? (
        <ol className="flex flex-col gap-1">
          {entries.map((entry) => (
            <TopFiveRow key={entry.rank} entry={entry} />
          ))}
        </ol>
      ) : (
        <div className="rounded px-1 py-1.5">
          <span className="type-label text-ink-muted">No rankings yet</span>
        </div>
      )}
      <Link href="/leaderboard" className="flex items-center justify-between pt-1 text-ink-muted hover:text-ink">
        <span className="type-label">Global ladder</span>
        <ArrowForwardIcon width={9} height={9} />
      </Link>
    </section>
  );
}

// Stitch "Hotfix — Daily Challenge" › Leaderboard Table row: rank, handle, streak and the week's XP. The
// weekly board keeps no streaks, so that slot shows "—"; the leader's rank and every XP are amber.
function TopFiveRow({ entry }: { entry: LeaderboardResponse["entries"][number] }) {
  const name = topFiveName(entry);
  return (
    <li className="flex items-center justify-between rounded px-1 py-1.5 hover:bg-control">
      <span className="flex min-w-0 items-center gap-2">
        <span className={`w-4 font-mono text-[11px] leading-[14px] font-bold ${entry.rank === 1 ? "text-warn" : "text-ink-muted"}`}>#{entry.rank}</span>
        {entry.handle ? (
          <Link href={`/u/${entry.handle}`} className="truncate font-mono text-[11px] leading-[14px] text-ink hover:text-accent-soft">
            {name}
          </Link>
        ) : (
          <span className="truncate font-mono text-[11px] leading-[14px] text-ink">{name}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2 font-mono text-[11px] leading-[14px]">
        <span className="text-ink-muted">—</span>
        <span className="font-medium text-warn">{formatScore("weekly", entry.score)}</span>
      </span>
    </li>
  );
}
