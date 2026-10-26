import Link from "next/link";
import { CodeHostIcon, CommunityIcon, GuestAvatarIcon } from "../../ui/icons-landing";
import { LogoMark } from "../../ui/logo-mark";
import { PhoneMenu } from "../../ui/phone-menu";

// Figma (Landing) › Header. Leaderboard and sign-in have no screens yet, so they are not links. The bar
// spans the window; its content spans it too (owner, 2026-10-14).
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-[#3c494c66] bg-[#0e0e0fe5] backdrop-blur">
      <div className="frame flex h-14 items-center justify-between px-4 lg:px-8">
        <span className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <LogoMark />
            <span className="font-mono text-[13px] leading-[18px] font-semibold text-accent-soft">&gt;_</span>
            <span className="text-lg leading-6 font-semibold tracking-[-0.45px] text-ink">greenbuild</span>
          </Link>
          <span className="type-label rounded border border-[#3c494c99] bg-surface px-1 py-0.5 text-ink-subtle">beta</span>
        </span>
        <span className="hidden items-center gap-5 lg:flex">
          <NavLinks className="flex items-center gap-5" />
          <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-[#00363e]">
            <GuestAvatarIcon />
          </span>
        </span>
        <span className="flex items-center gap-2 lg:hidden">
          <Link href="/onboarding" className="flex h-9 items-center rounded-lg bg-accent px-3 text-[13px] font-semibold text-[#00363e]">
            Start
          </Link>
          <PhoneMenu>
            <NavLinks className="flex flex-col gap-3" />
          </PhoneMenu>
        </span>
      </div>
    </header>
  );
}

function NavLinks({ className }: { className: string }) {
  return (
    <nav className={`${className} text-[13px] leading-[18px] text-ink-muted`}>
      <span aria-disabled="true">Leaderboard</span>
      <Link href="/challenges">Challenges</Link>
      <span aria-disabled="true">Sign in</span>
    </nav>
  );
}


// Figma (Landing) › Footer. Terms, privacy, code and community pages do not exist yet. Like the header,
// the bar spans the window, and it stays at the window's bottom (owner, 2026-10-14).
export function LandingFooter() {
  return (
    <footer className="z-10 border-t border-[#3c494c66] bg-canvas lg:sticky lg:bottom-0">
      <div className="type-label frame flex flex-col items-start gap-3 px-4 py-5 text-ink-subtle lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <span className="flex flex-wrap items-center gap-3">
          <span>&gt;_ greenbuild © 2026</span>
          <span className="text-[#3c494c]">|</span>
          <span>Production Outage Simulation</span>
        </span>
        <span className="flex flex-wrap items-center gap-5">
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
