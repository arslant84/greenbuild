import { FlagIcon, LightbulbIcon, PlayIcon } from "../../../../ui/icons";

interface ActionPanelProps {
  onCheck: () => void;
  checking: boolean;
  canCheck: boolean;
}

// Figma › Action Panel & Verification CTA. Hints and giving up arrive with their API endpoints;
// until then they are shown but inert.
export function ActionPanel({ onCheck, checking, canCheck }: ActionPanelProps) {
  return (
    <div className="flex flex-col gap-3 pt-5">
      <span className="flex h-10 items-center justify-between rounded-lg bg-surface px-3 opacity-60 shadow-[0_1px_2px_rgba(0,0,0,0.05)]" aria-disabled="true">
        <span className="flex items-center gap-1">
          <LightbulbIcon className="text-warn" />
          <span className="type-body font-medium text-ink">Get Diagnostic Hint</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="type-label text-ink-subtle">— left</span>
          <kbd className="type-label rounded bg-line px-1.5 py-0.5 text-ink">⌘H</kbd>
        </span>
      </span>
      <button
        type="button"
        onClick={onCheck}
        disabled={!canCheck || checking}
        className="flex h-12 items-center justify-center gap-2 rounded-lg bg-accent text-[#005763] shadow-[0_10px_15px_-3px_rgba(34,211,238,0.2)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <PlayIcon />
        <span className="text-lg leading-6 font-semibold tracking-[0.45px]">{checking ? "Running check…" : "Check Solution"}</span>
        <kbd className="type-label ml-1 rounded bg-[#00576326] px-2 py-0.5 font-medium">⌘ + ↵</kbd>
      </button>
      <span className="flex items-center justify-center gap-1 pt-1 text-ink-subtle" aria-disabled="true">
        <FlagIcon />
        <span className="type-label">Give up attempt and inspect solution runbook</span>
      </span>
    </div>
  );
}
