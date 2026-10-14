import Link from "next/link";
import { CodeHostIcon, CommunityIcon, GuestAvatarIcon } from "../../ui/icons-landing";

// Figma (Landing) › Header. Leaderboard and sign-in have no screens yet, so they are not links. The bar
// spans the window; its content spans it up to 1920 px (owner, 2026-10-14).
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-[#3c494c66] bg-[#0e0e0fe5] backdrop-blur">
      <div className="frame flex h-14 items-center justify-between px-8">
        <span className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-mono text-[13px] leading-[18px] font-semibold text-accent-soft">&gt;_</span>
            <span className="text-lg leading-6 font-semibold tracking-[-0.45px] text-ink">greenbuild</span>
          </Link>
          <span className="type-label rounded border border-[#3c494c99] bg-surface px-1 py-0.5 text-ink-subtle">beta</span>
        </span>
        <span className="flex items-center gap-5">
          <nav className="flex items-center gap-5 text-[13px] leading-[18px] text-ink-muted">
            <span aria-disabled="true">Leaderboard</span>
            <Link href="/challenges">Challenges</Link>
            <span aria-disabled="true">Sign in</span>
          </nav>
          <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-[#00363e]">
            <GuestAvatarIcon />
          </span>
        </span>
      </div>
    </header>
  );
}

// Figma (Landing) › Footer. Terms, privacy, code and community pages do not exist yet. Like the header,
// the bar spans the window.
export function LandingFooter() {
  return (
    <footer className="border-t border-[#3c494c66] bg-canvas">
      <div className="type-label frame flex items-center justify-between px-8 py-5 text-ink-subtle">
        <span className="flex items-center gap-3">
          <span>&gt;_ greenbuild © 2026</span>
          <span className="text-[#3c494c]">|</span>
          <span>Production Outage Simulation</span>
        </span>
        <span className="flex items-center gap-5">
          <span>Terms</span>
          <span>Privacy</span>
          <span className="flex items-center gap-1">
            <CodeHostIcon />
            GitHub
          </span>
          <span className="flex items-center gap-1">
            <CommunityIcon />
            Community
          </span>
        </span>
      </div>
    </footer>
  );
}
