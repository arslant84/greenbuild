import Link from "next/link";
import { AvatarIcon, SettingsIcon, StreakIcon } from "./icons-catalog";
import { LogoMark } from "./logo-mark";

// Sections without a screen yet are shown as in Figma but are not links.
const SECTIONS = [
  { label: "Challenges", href: "/challenges" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Marketplace", href: null },
  { label: "Inbox", href: null },
  { label: "Settings", href: "/settings" },
] as const;

type Section = (typeof SECTIONS)[number]["label"];

// Figma (Browse Challenge Catalog) › Header. Currency, level, streak and the handle have no data yet. The bar
// spans the window; its content spans it too (owner, 2026-10-14).
export function TopNav({ current }: { current: Section }) {
  return (
    <header className="bg-[#131314e5] backdrop-blur">
      <div className="frame flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/play" className="flex items-center gap-1 text-accent-soft">
            <LogoMark />
            <span className="font-mono text-[13px] leading-[18px] font-semibold tracking-[0.65px] text-ink uppercase">greenbuild</span>
          </Link>
          <nav className="flex items-center gap-1">
            {SECTIONS.map((section) => (
              <NavItem key={section.label} label={section.label} href={section.href} active={section.label === current} />
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 rounded bg-surface px-3 py-1">
            <span className="font-mono text-[11px] leading-[14px] font-semibold tracking-[0.44px] text-warn">— GLK</span>
            <span className="type-label text-ink-subtle">/</span>
            <span className="font-mono text-[11px] leading-[14px] font-medium tracking-[0.44px] text-accent-soft">LVL —</span>
            <span className="type-label text-ink-subtle">/</span>
            <span className="flex items-center gap-0.5 text-ok">
              <StreakIcon />
              <span className="font-mono text-[11px] leading-[14px] font-medium tracking-[0.44px]">—</span>
            </span>
          </span>
          <span className="flex items-center gap-2 pl-1">
            <span className="font-mono text-[13px] leading-[18px] text-ink-muted">@—</span>
            <Link href="/settings" aria-label="Settings" className="flex size-[27px] items-center justify-center rounded text-ink-muted hover:text-ink">
              <SettingsIcon />
            </Link>
            <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-[#00363e]">
              <AvatarIcon />
            </span>
          </span>
        </div>
      </div>
    </header>
  );
}

function NavItem({ label, href, active }: { label: string; href: string | null; active: boolean }) {
  const look = `rounded px-3 py-1.5 text-[13px] leading-[18px] ${active ? "bg-control font-medium text-accent-soft" : "text-ink-muted"}`;
  return href ? (
    <Link href={href} className={look} aria-current={active ? "page" : undefined}>
      {label}
    </Link>
  ) : (
    <span className={`${look} cursor-default`} aria-disabled="true">
      {label}
    </span>
  );
}
