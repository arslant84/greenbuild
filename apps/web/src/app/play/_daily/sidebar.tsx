import type { ComponentType, SVGProps } from "react";
import { BadgeIcon, CatalogIcon, FlameIcon, LeaderboardIcon, PersonIcon, TerminalIcon, TuneIcon } from "../../../ui/icons";

interface NavItem {
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  active?: boolean;
}

// Catalog, leaderboards and profile arrive with their features; until then they do not navigate.
const NAV: NavItem[] = [
  { label: "Daily", Icon: TerminalIcon, active: true },
  { label: "Catalog", Icon: CatalogIcon },
  { label: "Leaderboards", Icon: LeaderboardIcon },
  { label: "Profile", Icon: BadgeIcon },
];

// Figma "Hotfix — Daily Challenge" › Aside: 240 px, brand and nav on top, streak and player at the bottom.
export function Sidebar() {
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col justify-between border-r border-[#3c494c4d] bg-canvas p-3">
      <div className="flex flex-col gap-5">
        <div className="flex h-[22px] items-center justify-between px-1 pt-1">
          <span className="font-mono text-[13px] leading-[18px] font-semibold tracking-[-0.32px] text-accent-soft">&gt;_ greenbuild</span>
          <span className="type-label rounded border border-[#3c494c66] bg-line px-1.5 py-0.5 tracking-[0.5px] text-[#2fd9f4] uppercase">Beta</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink key={item.label} item={item} />
          ))}
        </nav>
      </div>
      <SidebarFooter />
    </aside>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const colors = item.active ? "bg-control text-accent-soft shadow-[inset_2px_0_0_#22d3ee]" : "text-ink-muted";
  return (
    <a
      href={item.active ? "/play" : undefined}
      aria-current={item.active ? "page" : undefined}
      aria-disabled={item.active ? undefined : true}
      className={`type-body flex h-[34px] items-center gap-2 rounded-lg px-3 py-2 ${colors}`}
    >
      <item.Icon />
      {item.label}
    </a>
  );
}

// Streak and profile details come with accounts and the game layer; until then they show empty values.
function SidebarFooter() {
  return (
    <div className="flex flex-col gap-1 border-t border-[#3c494c33] pt-3">
      <div className="flex items-center justify-between p-1">
        <span className="flex items-center gap-1 text-warn">
          <FlameIcon width={11} height={13} />
          <span className="type-label font-semibold tracking-[0.5px] uppercase">0 day streak</span>
        </span>
        <span className="size-2 rounded-full bg-line" />
      </div>
      <div className="flex items-center justify-between rounded-lg p-1">
        <span className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-[#00363e]">
            <PersonIcon />
          </span>
          <span className="flex flex-col">
            <span className="type-label font-medium text-ink">Dev player</span>
            <span className="type-label text-ink-muted">—</span>
          </span>
        </span>
        <span className="rounded px-1 pt-1 pb-2 text-ink-muted" aria-hidden="true">
          <TuneIcon />
        </span>
      </div>
    </div>
  );
}
