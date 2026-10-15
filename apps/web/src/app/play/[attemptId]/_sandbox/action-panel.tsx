import { FlagIcon, LightbulbIcon, PlayIcon } from "../../../../ui/icons";

export type ActionMode = "ready" | "checking" | "reconnecting" | "exhausted";

interface ActionPanelProps {
  mode: ActionMode;
  onCheck: () => void;
  onGiveUp: () => void;
}

// Figma › Action Panel & Verification CTA, with V2's checking and V5's reconnecting buttons.
// The hint row stays inert until a Figma frame shows a revealed hint (task 35c); the hints API is done.
export function ActionPanel({ mode, onCheck, onGiveUp }: ActionPanelProps) {
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
      <CheckButton mode={mode} onCheck={onCheck} />
      <button type="button" onClick={onGiveUp} className="flex cursor-pointer items-center justify-center gap-1 pt-1 text-ink-subtle">
        <FlagIcon />
        <span className="type-label">Give up attempt and inspect solution runbook</span>
      </button>
    </div>
  );
}

function CheckButton({ mode, onCheck }: Pick<ActionPanelProps, "mode" | "onCheck">) {
  if (mode === "checking") {
    return (
      <div className="flex flex-col gap-1">
        <span className="flex h-12 items-center justify-center gap-2 rounded-lg bg-[#22d3eed9] px-5 py-3 text-[#00363e] shadow-[0_10px_15px_-3px_rgba(34,211,238,0.2)]">
          <span className="size-5 animate-spin rounded-full border-[3px] border-[#00363e]/30 border-t-[#00363e]" />
          <span className="text-lg leading-6 font-semibold tracking-[-0.45px]">Running check…</span>
        </span>
        <span className="type-label text-center text-ink-subtle">Evaluating changes in isolated test container...</span>
      </div>
    );
  }
  if (mode === "reconnecting") {
    return (
      <span className="flex h-11 items-center justify-center gap-2 rounded-lg bg-control text-warn shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <span className="size-4 animate-spin rounded-full border-2 border-warn/30 border-t-warn" />
        <span className="font-mono text-[13px] leading-[18px] font-semibold">Reconnecting to sandbox…</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onCheck}
      disabled={mode === "exhausted"}
      className="flex h-12 items-center justify-center gap-2 rounded-lg bg-accent text-[#005763] shadow-[0_10px_15px_-3px_rgba(34,211,238,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <PlayIcon />
      <span className="text-lg leading-6 font-semibold tracking-[0.45px]">Check Solution</span>
      <kbd className="type-label ml-1 rounded bg-[#00576326] px-2 py-0.5 font-medium">⌘ + ↵</kbd>
    </button>
  );
}
