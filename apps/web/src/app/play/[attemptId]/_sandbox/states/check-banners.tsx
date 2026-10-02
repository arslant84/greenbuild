import { CancelIcon, CheckSmallIcon, SyncIcon } from "../../../../../ui/icons";

// The checker's first non-empty line says what is still wrong.
export function firstLine(output: string): string {
  return output.split("\n").find((line) => line.trim() !== "")?.trim() ?? "";
}

// Figma V4 › FAILURE BANNER (34 px, over the terminal pane).
export function FailureBanner({ output, checksLeft }: { output: string; checksLeft: number }) {
  return (
    <div className="flex h-[34px] shrink-0 items-center justify-between bg-[#93000ae5] px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-sm">
      <span className="flex min-w-0 items-center gap-2 text-danger">
        <CancelIcon />
        <span className="truncate font-mono text-[13px] leading-[18px] font-medium tracking-[-0.32px] text-[#ffdad6]">
          Check failed: {firstLine(output) || "the checker did not pass"}
        </span>
      </span>
      <span className="ml-2 shrink-0 rounded bg-[#0e0e0fcc] px-2 py-0.5 font-mono text-[10px] leading-3 font-semibold tracking-[0.5px] text-danger uppercase">
        {checksLeft} checks remaining
      </span>
    </div>
  );
}

// Figma V3 › validation card, shown in the same place as the failure banner.
export function SuccessBanner({ output }: { output: string }) {
  return (
    <div className="flex shrink-0 items-start gap-2 bg-surface-raised px-3 py-2.5">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-ok text-[#003915]">
        <CheckSmallIcon />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-mono text-[13px] leading-[18px]">
          <span className="font-semibold text-ok">[GREENBUILD VALIDATION RIG]</span>{" "}
          <span className="font-medium text-ink">Check passed.</span>
        </span>
        <span className="type-label truncate text-ink-muted">{firstLine(output)}</span>
      </span>
    </div>
  );
}

interface ReconnectBannerProps {
  retry: number;
  maxRetries: number;
  onReconnect: () => void;
}

// Figma V5 › Bold Amber Reconnecting Banner (44 px).
export function ReconnectBanner({ retry, maxRetries, onReconnect }: ReconnectBannerProps) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between bg-control px-4 py-2.5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]">
      <span className="flex items-center gap-3">
        <span className="size-3 animate-pulse rounded-full bg-warn" />
        <span className="font-mono text-[13px] leading-[18px] font-medium text-warn">Sandbox disconnected. Reconnecting…</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="type-label font-semibold text-ink">
          Attempt {Math.min(retry, maxRetries)} of {maxRetries}
        </span>
        <button type="button" onClick={onReconnect} className="flex items-center gap-1 rounded bg-[#ffc64026] px-3 py-1 text-warn">
          <SyncIcon />
          <span className="font-mono text-[11px] leading-[14px] font-medium tracking-[0.44px]">Reconnect now</span>
        </button>
      </span>
    </div>
  );
}
