import Link from "next/link";
import { CodeHostIcon, GuestAvatarIcon } from "../../ui/icons-landing";
import { Brand } from "../../ui/brand";
import { PhoneMenu } from "../../ui/phone-menu";

// Figma (Landing) › Header. The avatar opens the player's profile, which sends a visitor to sign in first.
// The bar spans the window; its content spans it too (owner, 2026-10-14).
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-[#3c494c66] bg-[#0e0e0fe5] backdrop-blur">
      <div className="frame flex h-14 items-center justify-between px-4 lg:px-8">
        <span className="flex items-center gap-3">
          <Brand />
          <span className="type-label rounded border border-[#3c494c99] bg-surface px-1 py-0.5 text-ink-subtle">beta</span>
        </span>
        <span className="hidden items-center gap-5 lg:flex">
          <NavLinks className="flex items-center gap-5" />
          <Link href="/profile" aria-label="Your profile" className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-[#00363e]">
            <GuestAvatarIcon />
          </Link>
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
      <Link href="/leaderboard">Leaderboard</Link>
      <Link href="/challenges">Challenges</Link>
      <Link href="/signin">Sign in</Link>
    </nav>
  );
}


// The repository has been public since 2026-10-13 (architecture.md, deviation 29).
const SOURCE_REPOSITORY_URL = "https://github.com/arslant84/greenbuild";

// Figma (Landing) › Footer. No task builds a community space, so Community is hidden (deviation 37). Like
// the header, the bar spans the window, and it stays at the window's bottom (owner, 2026-10-14).
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
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <a href={SOURCE_REPOSITORY_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-ink">
            <CodeHostIcon />
            GitHub
          </a>
        </span>
      </div>
    </footer>
  );
}
