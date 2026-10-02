import { BoltIcon, FlameIcon, ScheduleIcon } from "../../../ui/icons";

// Figma › Header - TOP STATUS TELEMETRY BAR. Streak, XP, level and the daily reset arrive with the game
// layer (Stage 2); until then the bar keeps its layout and shows empty values.
export function StatusBar() {
  return (
    <header className="flex h-11 items-center justify-between rounded-xl bg-surface px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-3">
        <span className="flex h-[26px] items-center gap-1 rounded-lg bg-control px-2 py-1">
          <FlameIcon className="text-warn" />
          <span className="type-body font-semibold text-ink">Day 0</span>
        </span>
        <span className="flex items-center gap-1 rounded-lg bg-[#ffc6401a] px-2 py-1 text-warn">
          <BoltIcon width={11} height={13} />
          <span className="font-mono text-[11px] leading-[14px] font-semibold tracking-[0.55px]">+0 XP TODAY</span>
        </span>
        <LevelRing />
      </div>
      <span className="flex items-center gap-1 rounded bg-[#35343666] px-2 py-1 text-ink-muted">
        <ScheduleIcon />
        <span className="type-label">Next scenario in --:--:--</span>
      </span>
    </header>
  );
}

function LevelRing() {
  return (
    <span className="flex items-center gap-1 pl-1">
      <span className="relative flex size-7 items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" className="absolute inset-0">
          <circle cx="14" cy="14" r="12.5" fill="none" stroke="#353436" strokeWidth="2.33" />
        </svg>
        <span className="font-mono text-[10px] leading-3 font-semibold tracking-[0.2px] text-accent-soft">—</span>
      </span>
      <span className="flex flex-col">
        <span className="flex items-center gap-1">
          <span className="font-mono text-[10px] leading-3 font-semibold tracking-[-0.25px] text-ink">LVL —</span>
        </span>
        <span className="font-mono text-[9px] leading-[9px] text-accent-soft">0% PROGRESS</span>
      </span>
    </span>
  );
}
