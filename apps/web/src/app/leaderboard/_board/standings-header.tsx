import Link from "next/link";
import { PlayerIcon, SearchIcon } from "../../../ui/icons-leaderboard";
import { Brand } from "../../../ui/brand";
import { PhoneMenu } from "../../../ui/phone-menu";

// Figma (Global Standings, 3:3639) › Header. Runbooks has no page, so it is text; the search box is not
// built (no search yet) and shows as in the frame, disabled. The bar spans the window; its content spans it
// too (owner, 2026-10-14).
export function StandingsHeader({ handle, streak }: { handle: string | null; streak: number | null }) {
  return (
    <header className="bg-[#131314e5] shadow-[0_1px_0_#2a2a2b] backdrop-blur">
      <div className="frame flex h-14 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Brand />
          <span className="rounded bg-control px-1 py-0.5 font-mono text-[11px] leading-3.5 font-medium tracking-[0.44px] text-ink-muted">beta</span>
          <BoardNav className="hidden items-center gap-1 pl-3 lg:flex" />
        </div>
        <PlayerChips handle={handle} streak={streak} />
        <PhoneMenu>
          <BoardNav className="flex flex-col items-start gap-1" />
        </PhoneMenu>
      </div>
    </header>
  );
}

function BoardNav({ className }: { className: string }) {
  return (
    <nav className={className}>
      <Link href="/challenges" className="rounded-lg px-2 py-1.5 type-body text-ink-muted">
        Challenges
      </Link>
      <span aria-current="page" className="rounded-lg bg-accent px-2 py-1.5 type-body font-medium text-[#005763]">
        Leaderboards
      </span>
      <span className="rounded-lg px-2 py-1.5 type-body text-ink-muted">Runbooks</span>
    </nav>
  );
}

function PlayerChips({ handle, streak }: { handle: string | null; streak: number | null }) {
  return (
    <div className="hidden items-center gap-3 lg:flex">
      <span className="flex w-41.75 items-center gap-2 rounded-lg bg-canvas px-2 py-1">
        <SearchIcon className="text-ink-muted" />
        <input disabled aria-label="Search" placeholder="CMD+K" className="w-24 bg-transparent type-body text-ink-subtle placeholder:text-ink-subtle" />
        <span className="rounded bg-control px-1 py-0.5 type-label text-ink-subtle">⌘K</span>
      </span>
      <span className="flex items-center gap-1.5 rounded bg-[#e3aa001a] p-1 type-label text-warn">
        {streak === null ? "—" : `${streak}d`}
        <span aria-hidden className="font-mono text-[11px] leading-3.5">🔥</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-[#00363e]">
          <PlayerIcon />
        </span>
        <span className="type-body text-ink-muted">@{handle ?? "—"}</span>
      </span>
    </div>
  );
}
