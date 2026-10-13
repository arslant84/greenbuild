import Link from "next/link";
import { SortChevronIcon } from "../../../ui/icons-leaderboard";
import { type BoardTab, boardHref } from "./board-view";

// Badges without data show "—": the number of skill domains, the daily challenge's number, friends online.
const TABS: { tab: BoardTab | null; label: string; badge: string | null; badgeColor?: string }[] = [
  { tab: "weekly", label: "Weekly", badge: "LIVE" },
  { tab: "country", label: "Country", badge: null },
  { tab: "skill", label: "By Skill", badge: "— DOMAINS" },
  { tab: "daily", label: "Daily Challenge", badge: "#—", badgeColor: "text-warn" },
  // No friends yet (lb:friends is not stored): the tab is shown, disabled.
  { tab: null, label: "Friends", badge: "— ONLINE" },
];

// Role filters, search and sort have no data behind them yet; they are shown as in the frame, disabled.
const ROLE_FILTERS = ["All Roles (All)", "Staff / Principal", "Platform & SRE", "Kernel & Linux", "Open to Offers", "Verified (Stage 3+)"];

// Figma (Global Standings) › Navigation / Terminal Tabs and Filter Controls Strip.
export function BoardTabs({ current }: { current: BoardTab }) {
  return (
    <div className="flex flex-col bg-surface">
      <nav className="flex">
        {TABS.map(({ tab, label, badge, badgeColor }) => (
          <TabButton key={label} tab={tab} label={label} badge={badge} badgeColor={badgeColor ?? "text-ink-subtle"} active={tab === current} />
        ))}
      </nav>
      <div className="flex items-center justify-between bg-canvas p-2">
        <div className="flex items-center gap-1">
          {ROLE_FILTERS.map((filter, index) => (
            <button
              key={filter}
              type="button"
              disabled
              className={`rounded px-2 py-1 type-label ${index === 0 ? "bg-control font-medium text-ink" : "bg-surface text-ink-muted"}`}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="flex w-35.5 items-center gap-1 rounded bg-surface px-2 py-1">
            <span className="type-label text-ink-subtle">$</span>
            <input disabled aria-label="Search players" placeholder="grep @handle or org..." className="w-full bg-transparent type-body text-ink-subtle placeholder:text-ink-subtle" />
          </span>
          <span className="flex items-center gap-1 rounded bg-surface px-2 py-1 type-label">
            <span className="text-ink-subtle">SORT:</span>
            <span className="font-medium text-ink">{current === "daily" ? "TIME (ASC)" : "SCORE (DESC)"}</span>
            <SortChevronIcon className="text-ink-subtle" />
          </span>
        </div>
      </div>
    </div>
  );
}

interface TabButtonProps {
  tab: BoardTab | null;
  label: string;
  badge: string | null;
  badgeColor: string;
  active: boolean;
}

function TabButton({ tab, label, badge, badgeColor, active }: TabButtonProps) {
  const look = `relative flex items-center gap-1 px-3 py-2 type-body ${active ? "bg-surface-raised font-medium text-ink" : "text-ink-muted"}`;
  const content = (
    <>
      {label}
      {badge && <span className={`rounded px-1 type-label ${active ? "bg-accent text-[#005763]" : `bg-line ${badgeColor}`}`}>{badge}</span>}
      {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />}
    </>
  );
  return tab ? (
    <Link href={boardHref(tab)} className={look} aria-current={active ? "page" : undefined}>
      {content}
    </Link>
  ) : (
    <span className={look} aria-disabled="true">
      {content}
    </span>
  );
}
