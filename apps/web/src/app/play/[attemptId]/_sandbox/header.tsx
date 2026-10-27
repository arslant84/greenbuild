import Link from "next/link";
import { formatElapsed } from "../../../../ui/format";
import { LogoutIcon, PersonIcon, TimerCompactIcon } from "../../../../ui/icons";
import { Brand } from "../../../../ui/brand";

interface SandboxHeaderProps {
  incident: string;
  elapsedSeconds: number;
  onExit: () => void;
}

// Figma "Hotfix Sandbox — V1 Default State" › Header (1280 × 44).
export function SandboxHeader({ incident, elapsedSeconds, onExit }: SandboxHeaderProps) {
  return (
    <header className="relative z-10 flex h-11 shrink-0 items-center justify-between bg-surface px-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-3">
        <Brand />
        <span className="h-4 w-px bg-[#3c494c]" />
        <span className="flex items-center gap-1">
          <span className="type-label tracking-[0.5px] text-ink-muted uppercase">Incident:</span>
          <span className="font-mono text-[13px] leading-[18px] font-semibold text-ink">#{incident}</span>
          <span className="ml-1 size-2 rounded-full bg-danger" />
        </span>
      </div>
      <div className="flex items-center gap-5">
        <span className="flex items-center gap-1 rounded bg-surface-raised px-2 py-0.5">
          <TimerCompactIcon className="text-warn" />
          <span className="type-label text-warn">{formatElapsed(elapsedSeconds)}</span>
          <span className="type-label text-ink-subtle">SYNCED</span>
        </span>
        <span className="flex items-center gap-3">
          <button type="button" onClick={onExit} className="flex cursor-pointer items-center gap-1 text-ink-muted">
            <LogoutIcon />
            <span className="font-mono text-[13px] leading-[18px]">Exit Attempt</span>
          </button>
          <Link href="/profile" aria-label="Your profile" className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-[#00363e]">
            <PersonIcon width={11} height={11} />
          </Link>
        </span>
      </div>
    </header>
  );
}
