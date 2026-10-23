"use client";

import type { AttemptResponse } from "@greenbuild/shared";
import { LightbulbIcon } from "../../../../ui/icons";
import { HINT_PENALTY_PERCENT, xpPenaltyPercent } from "./hints";
import { useHints } from "./use-hint";

interface HintButtonProps {
  used: number;
  total: number;
  enabled: boolean;
  onOpen: () => void;
}

interface HintControlProps {
  attempt: AttemptResponse;
  ready: boolean;
  refresh: () => Promise<unknown>;
}

// HintControl is the hint button wired to the attempt: it opens the next hint and refreshes the attempt.
export function HintControl({ attempt, ready, refresh }: HintControlProps) {
  const hints = useHints(attempt, ready, refresh);
  return <HintButton used={attempt.hints.length} total={attempt.hints_total} enabled={hints.canOpen} onOpen={() => void hints.open()} />;
}

// Figma › Hint Button with Shortcut Badge, with Stitch V6's XP note and its "no hints left" state (task 35c).
function HintButton({ used, total, enabled, onOpen }: HintButtonProps) {
  const left = total - used;
  if (left <= 0) {
    return <NoHintsLeft total={total} />;
  }
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onOpen}
        disabled={!enabled}
        className="group flex h-10 cursor-pointer items-center justify-between rounded-lg bg-surface px-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-control disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex items-center gap-1">
          <LightbulbIcon className="text-warn" />
          <span className="type-body font-medium text-ink group-hover:text-warn">Get Diagnostic Hint</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="type-label text-ink-subtle">
            {left}/{total} left
          </span>
          <kbd className="type-label rounded bg-line px-1.5 py-0.5 text-ink">⌘H</kbd>
        </span>
      </button>
      <span className="type-label flex items-center justify-between px-1 text-ink-subtle">
        <span>Each hint lowers this solve&apos;s XP by {HINT_PENALTY_PERCENT}%</span>
        {used > 0 && <span className="font-medium text-warn">-{xpPenaltyPercent(used)}% applied</span>}
      </span>
    </div>
  );
}

function NoHintsLeft({ total }: { total: number }) {
  return (
    <span
      aria-disabled="true"
      className="type-label flex h-8 cursor-not-allowed items-center justify-between rounded border border-[#3c494c66] bg-surface/50 px-3 text-ink-subtle opacity-50 select-none"
    >
      <span className="flex items-center gap-1">
        <LightbulbIcon />
        <span>No hints left</span>
      </span>
      <span>0/{total}</span>
    </span>
  );
}
