import { LockIcon } from "../../../../../ui/icons";

// Figma "Hotfix Sandbox — V2 Checking State" › FROZEN EVALUATION OVERLAY. The checker runs as one
// script, so the checklist shows that single step instead of the frame's sample steps.
export function CheckingOverlay() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0e0e0fcc] p-5 backdrop-blur-sm">
      <div className="flex w-[448px] flex-col gap-5 rounded-xl bg-surface-raised p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col items-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#8aebff1a]">
            <span className="size-10 animate-spin rounded-full border-[5px] border-accent/30 border-t-accent" />
          </span>
          <div className="flex flex-col items-center gap-0.5 pt-2">
            <h2 className="text-lg leading-6 font-semibold tracking-[-0.45px] text-ink">Evaluating Sandbox State...</h2>
            <span className="type-label text-ink-muted">EPHEMERAL VALIDATION TEST CONTAINER</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-lg bg-surface p-3">
          <div className="flex items-center justify-between rounded bg-control p-1">
            <span className="flex items-center gap-2">
              <span className="size-3.5 animate-spin rounded-full border-2 border-accent-soft/30 border-t-accent-soft" />
              <span className="font-mono text-[13px] leading-[18px] font-medium text-ink">Running the challenge checker</span>
            </span>
            <span className="type-label pl-1 text-accent-soft uppercase">Running</span>
          </div>
        </div>
        <span className="flex items-center justify-center gap-1 text-ink-muted">
          <LockIcon width={11} height={13} />
          <span className="type-label">Terminal input is locked during validation.</span>
        </span>
      </div>
    </div>
  );
}
