"use client";

import { type ComponentType, type SVGProps, useState } from "react";
import { BadgeIcon, KeyIcon, NotificationsIcon, ScheduleIcon, VisibilityIcon, WarningIcon, WorkIcon } from "../../../ui/icons-settings";

interface Section {
  id: string;
  title: string;
  note: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

// The frame's sections, in its order; each links to its card on the page.
const SECTIONS: Section[] = [
  { id: "profile", title: "Profile", note: "Avatar, handle, bio", Icon: BadgeIcon },
  { id: "account", title: "Account", note: "Auth, email, sessions", Icon: KeyIcon },
  { id: "timezone", title: "Timezone & Streak", note: "Offset & daily cadence", Icon: ScheduleIcon },
  { id: "notifications", title: "Notifications", note: "Email & alert triggers", Icon: NotificationsIcon },
  { id: "privacy", title: "Visibility & Privacy", note: "Public discoverability", Icon: VisibilityIcon },
  { id: "hiring", title: "Open to Offers", note: "Company inquiries", Icon: WorkIcon },
];

// Frame 7:10273 › settings sidebar. The frame's storage quota and ID hash are nothing greenbuild keeps, so
// the block shows "—".
export function SettingsNav() {
  const [active, setActive] = useState("profile");
  return (
    <aside className="flex flex-col gap-3 lg:sticky lg:top-22 lg:col-span-3 lg:self-start">
      <div className="rounded-xl bg-surface-raised p-3 shadow-sm">
        <div className="mb-1 flex items-center justify-between px-2 pb-2">
          <span className="type-label tracking-wider text-ink-subtle uppercase">Settings / Config</span>
          <span className="size-2 rounded-full bg-ok" />
        </div>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {SECTIONS.map((section) => (
            <NavItem key={section.id} section={section} active={active === section.id} onSelect={() => setActive(section.id)} />
          ))}
          <a
            href="#section-danger"
            onClick={() => setActive("danger")}
            className={`flex shrink-0 items-start gap-2 rounded-lg p-2 text-danger hover:bg-[#93000a33] ${active === "danger" ? "bg-[#93000a33]" : ""}`}
          >
            <WarningIcon className="mt-0.5 text-[18px]" />
            <span className="min-w-0 flex-1">
              <span className="block type-body leading-none font-medium">Danger Zone</span>
              <span className="mt-1 hidden truncate type-label text-danger/70 lg:block">Export &amp; destroy data</span>
            </span>
          </a>
        </nav>
        <div className="mt-3 flex flex-col gap-1 rounded bg-canvas p-2 type-label text-ink-subtle">
          <span className="flex items-center justify-between">
            <span>STORAGE QUOTA</span>
            <span className="text-ok">—</span>
          </span>
          <span className="h-1 w-full overflow-hidden rounded-full bg-control" />
        </div>
      </div>
    </aside>
  );
}

function NavItem({ section, active, onSelect }: { section: Section; active: boolean; onSelect: () => void }) {
  const look = active ? "bg-control text-accent-soft" : "text-ink-muted hover:bg-control/60 hover:text-ink";
  return (
    <a href={`#section-${section.id}`} onClick={onSelect} className={`flex shrink-0 items-start gap-2 rounded-lg p-2 ${look}`}>
      <section.Icon className={`mt-0.5 text-[18px] ${section.id === "hiring" ? "text-warn" : ""}`} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between">
          <span className={`type-body leading-none font-medium ${active ? "text-ink" : ""}`}>{section.title}</span>
          {section.id === "hiring" && <span className="rounded bg-[#e3aa0033] px-1.5 py-0.5 type-label text-warn">Hiring</span>}
        </span>
        <span className="mt-1 hidden truncate type-label text-ink-subtle lg:block">{section.note}</span>
      </span>
    </a>
  );
}
