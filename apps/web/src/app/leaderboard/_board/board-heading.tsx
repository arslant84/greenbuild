import { type BoardTab, resetsIn, weekLabel } from "./board-view";

const BOARD_NAME: Record<BoardTab, string> = { weekly: "WEEKLY XP", country: "COUNTRY XP", skill: "SKILL RATING", daily: "DAILY SOLVE TIME" };

// Figma (Global Standings) › Context Bar & Standings Meta. The week and its reset are real; there are no
// seasons and no total count yet, so those show "—". The rig line names the real rating system.
export function BoardHeading({ tab, now }: { tab: BoardTab; now: Date }) {
  return (
    <div className="flex flex-col items-start gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-control px-1.5 py-0.5 font-mono text-[11px] leading-3.5 font-medium tracking-[0.44px] text-ink-muted">
            SEASON — · {weekLabel(now)}
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-ok" />
            <span className="type-label text-ok">LIVE METRICS</span>
          </span>
          <span className="type-label text-ink-subtle">RESETS IN: {resetsIn(now)}</span>
        </div>
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.8px] text-ink lg:text-[32px] lg:leading-10">Global Engineering Standings</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface px-3 py-2 type-label">
        <span className="text-ink-muted">TOTAL RANKED: —</span>
        <span className="text-ink-subtle">/</span>
        <span className="text-ink-muted">RATING: glicko-2</span>
        <span className="text-ink-subtle">/</span>
        <span className="font-medium text-accent">{BOARD_NAME[tab]}</span>
      </div>
    </div>
  );
}
