import type { LeaderboardResponse } from "@greenbuild/shared";
import Link from "next/link";
import { avatarColor, type BoardTab, formatScore, initials, rankLabel, rankStyle, SCORE_HEADER } from "./board-view";

type Entry = LeaderboardResponse["entries"][number];

// Figma (Global Standings) › Telemetry Table. Rank, handle and score are real; org, region, solves,
// streak and the week's rank change have no data yet and show "—". A player whose game profile is not
// public is listed without a name; a public one's handle links to their profile (task 46b).
export function BoardTable({ tab, entries, emptyText }: { tab: BoardTab; entries: Entry[]; emptyText: string }) {
  return (
    <div className="flex flex-col bg-surface shadow-[0_4px_12px_#00000040]">
      <div className="flex h-10 items-center bg-[#35343699] type-label tracking-[0.5px] text-ink-subtle">
        <span className="w-20 pl-3">RANK</span>
        <span className="flex-1 px-2">ENGINEER / ORG</span>
        <span className="w-36 px-2">NODE REGION</span>
        <span className="w-40 px-2 text-right">{SCORE_HEADER[tab]}</span>
        <span className="w-28 px-2 text-center">STREAK</span>
        <span className="w-24 pr-3 text-right">DELTA</span>
      </div>
      {entries.length === 0 ? (
        <p className="px-3 py-6 type-body text-ink-subtle">{emptyText}</p>
      ) : (
        entries.map((entry) => <BoardRow key={entry.rank} tab={tab} entry={entry} />)
      )}
      <div className="flex items-center justify-between bg-[#0e0e0fcc] px-3 py-2">
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-accent" />
          <span className="type-label text-ink-subtle">{entries.length === 0 ? "No players ranked yet" : `Showing 1–${entries.length}`}</span>
        </span>
        <span className="font-mono text-[9px] leading-3 tracking-[0.2px] text-ink-subtle">ALL TIMES UTC</span>
      </div>
    </div>
  );
}

function BoardRow({ tab, entry }: { tab: BoardTab; entry: Entry }) {
  const rank = rankStyle(entry.rank);
  return (
    <div id={`rank-${entry.rank}`} className="flex h-12.25 items-center border-t border-[#2a2a2b66] first:border-t-0">
      <span className={`w-20 pl-3 font-mono text-[13px] leading-4.5 ${rank.bold ? "font-bold" : ""}`} style={{ color: rank.color }}>
        {rankLabel(entry.rank)}
      </span>
      <span className="flex flex-1 items-center gap-2 px-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-line font-mono text-[11px] leading-4.5 font-bold" style={{ color: avatarColor(entry.rank) }}>
          {initials(entry.handle)}
        </span>
        <span className="flex flex-col">
          {entry.handle ? (
            <Link href={`/u/${entry.handle}`} className="font-mono text-[13px] leading-4.5 font-bold text-ink hover:text-accent-soft">
              @{entry.handle}
            </Link>
          ) : (
            <span className="font-mono text-[13px] leading-4.5 font-bold text-ink">Hidden player</span>
          )}
          <span className="font-mono text-[10px] leading-4.5 text-ink-subtle">{entry.display_name ?? "—"}</span>
        </span>
      </span>
      <span className="w-36 px-2 font-mono text-[12px] leading-4.5 text-ink-muted">—</span>
      <span className="flex w-40 flex-col items-end px-2">
        <span className="font-mono text-[13px] leading-4.5 font-bold text-ink">{formatScore(tab, entry.score)}</span>
        <span className="font-mono text-[9px] leading-4.5 text-ink-subtle">— solves · — verif</span>
      </span>
      <span className="flex w-28 justify-center px-2">
        <span className="rounded bg-control px-1.5 py-0.5 type-label font-medium text-warn">—</span>
      </span>
      <span className="w-24 pr-3 text-right type-label font-medium text-ink-subtle">—</span>
    </div>
  );
}
