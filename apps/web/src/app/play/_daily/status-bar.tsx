import type { MeResponse } from "@greenbuild/shared";
import { BoltIcon, FlameIcon, ScheduleIcon } from "../../../ui/icons";
import { type LevelView, levelView, xpAmount } from "../xp-view";

// The ring's radius in its 28 px box; the arc's length is the share of the circle to draw.
const RING_RADIUS = 12.5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface StatusBarProps {
  // The signed-in player, or null when the profile could not be read.
  player: MeResponse | null;
}

// Figma › Header - TOP STATUS TELEMETRY BAR. XP today and the level come from GET /v1/me (task 42b);
// the streak and the daily reset arrive with their tasks and show empty values until then.
export function StatusBar({ player }: StatusBarProps) {
  return (
    <header className="flex h-11 items-center justify-between rounded-xl bg-surface px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-3">
        <span className="flex h-[26px] items-center gap-1 rounded-lg bg-control px-2 py-1">
          <FlameIcon className="text-warn" />
          <span className="type-body font-semibold text-ink">Day 0</span>
        </span>
        <span className="flex items-center gap-1 rounded-lg bg-[#ffc6401a] px-2 py-1 text-warn">
          <BoltIcon width={11} height={13} />
          <span className="font-mono text-[11px] leading-[14px] font-semibold tracking-[0.55px]">+{player ? xpAmount(player.xp_today) : "0"} XP TODAY</span>
        </span>
        <LevelRing view={levelView(player)} />
      </div>
      <span className="flex items-center gap-1 rounded bg-[#35343666] px-2 py-1 text-ink-muted">
        <ScheduleIcon />
        <span className="type-label">Next scenario in --:--:--</span>
      </span>
    </header>
  );
}

function LevelRing({ view }: { view: LevelView }) {
  return (
    <span className="flex items-center gap-1 pl-1">
      <span className="relative flex size-7 items-center justify-center">
        {/* Figma: the ring starts at the top (rotated -90°), a #353436 track under a round-capped accent arc. */}
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" className="absolute inset-0 -rotate-90">
          <circle cx="14" cy="14" r={RING_RADIUS} fill="none" stroke="#353436" strokeWidth="2.33" />
          {view.progress > 0 && (
            <circle
              cx="14"
              cy="14"
              r={RING_RADIUS}
              fill="none"
              className="stroke-accent"
              strokeWidth="2.33"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - view.progress)}
            />
          )}
        </svg>
        <span className="font-mono text-[10px] leading-3 font-semibold tracking-[0.2px] text-accent-soft">{view.level}</span>
      </span>
      <span className="flex flex-col">
        <span className="flex items-center gap-1">
          <span className="font-mono text-[10px] leading-3 font-semibold tracking-[-0.25px] text-ink">LVL {view.level}</span>
        </span>
        <span className="font-mono text-[9px] leading-[9px] text-accent-soft">{view.percent} PROGRESS</span>
      </span>
    </span>
  );
}
