import { JumpIcon } from "../../../ui/icons-leaderboard";
import { type BoardTab, formatScore, initials, rankLabel } from "./board-view";

interface YourRowProps {
  tab: BoardTab;
  handle: string | null;
  me: { rank: number; score: number } | null;
  // Whether the player's row is among those shown, so "Jump to my position" has somewhere to go.
  listed: boolean;
  streak: number | null;
}

// Figma (Global Standings) › Pinned User Telemetry Drawer. The rank and score are the board's answer for
// the signed-in player; the bracket needs the total ranked, which there is not yet ("—").
export function YourRow({ tab, handle, me, listed, streak }: YourRowProps) {
  return (
    <div className="relative flex h-12 items-center justify-between overflow-hidden rounded-lg bg-[#0e0e0ff2] px-3 shadow-[0_4px_12px_#00000040] backdrop-blur">
      <span className="absolute inset-y-0 left-0 w-1 bg-accent" />
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-2">
          <span className="pl-1 font-mono text-[13px] leading-4.5 font-bold text-accent">{me ? rankLabel(me.rank) : "—"}</span>
          <span className="rounded bg-[#22d3ee1a] px-1.5 py-0.5 font-mono text-[9px] leading-4.5 font-bold text-accent">YOUR ROW</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="flex size-6 items-center justify-center rounded-full bg-accent-soft font-mono text-[10px] leading-4.5 font-bold text-[#00363e]">{initials(handle)}</span>
          <span className="font-mono text-[13px] leading-4.5 font-bold text-ink">@{handle ?? "—"}</span>
        </span>
      </div>
      <div className="flex items-center gap-5">
        <span className="flex items-center gap-3">
          <span className="flex flex-col items-end">
            <span className="font-mono text-[13px] leading-4.5 font-bold text-ink">{me ? formatScore(tab, me.score) : "—"}</span>
            <span className="font-mono text-[9px] leading-4.5 text-ink-subtle">— solves · — verif</span>
          </span>
          <span className="rounded bg-control px-1.5 py-0.5 type-label text-warn">{streak === null ? "—" : `${streak}d 🔥`}</span>
          <span className="type-label font-medium text-ink-subtle">—</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="rounded bg-control px-2 py-1 type-label text-ink-muted">— bracket</span>
          <JumpButton target={me && listed ? `#rank-${me.rank}` : null} />
        </span>
      </div>
    </div>
  );
}

function JumpButton({ target }: { target: string | null }) {
  const look = "flex items-center gap-0.5 rounded bg-accent px-2 py-1 type-label font-medium text-[#005763]";
  const content = (
    <>
      Jump to my position
      <JumpIcon />
    </>
  );
  return target ? (
    <a href={target} className={look}>
      {content}
    </a>
  ) : (
    <span className={look} aria-disabled="true">
      {content}
    </span>
  );
}
