import type { MeResponse } from "@greenbuild/shared";
import Link from "next/link";
import { PersonIcon } from "../../../ui/icons-profile";
import { SettingsIcon } from "../../../ui/icons-settings";
import { LABEL_BADGE, LABEL_CODE } from "../../../ui/type";
import { Brand } from "../../../ui/brand";
import { PhoneMenu } from "../../../ui/phone-menu";

const NAV = "py-1 type-body text-ink-muted hover:text-ink";

// Frame 7:10273 › header. The handle, level and streak are the player's; there is no single rating ("GLK")
// yet ("—"). Marketplace and Inbox are hidden until Stage 3 builds them (owner, 2026-10-27). The bar and
// its content span the window (owner, 2026-10-14).
export function SettingsHeader({ me }: { me: MeResponse | null }) {
  return (
    <header className="sticky top-0 z-50 bg-[#131314e6] shadow-[0_1px_8px_rgba(0,0,0,0.4)] backdrop-blur-xl">
      <div className="frame flex h-14 items-center justify-between gap-5 px-4 lg:px-6">
        <div className="flex shrink-0 items-center gap-8">
          <Brand />
          <HeaderLinks className="hidden items-center gap-5 lg:flex" />
        </div>
        <PlayerBadge me={me} />
        <span className="flex items-center gap-2 lg:hidden">
          <span className="rounded-lg bg-surface px-2 py-1 type-label text-warn">🔥 D{me?.streak.current ?? "—"}</span>
          <PhoneMenu>
            <HeaderLinks className="flex flex-col items-start gap-1" />
          </PhoneMenu>
        </span>
      </div>
    </header>
  );
}

function HeaderLinks({ className }: { className: string }) {
  return (
    <nav className={className}>
      <Link href="/challenges" className={NAV}>
        Challenges
      </Link>
      <Link href="/leaderboard" className={NAV}>
        Leaderboard
      </Link>
      <span aria-current="page" className="py-1 type-body font-medium text-accent-soft">
        Settings
      </span>
    </nav>
  );
}

function PlayerBadge({ me }: { me: MeResponse | null }) {
  return (
    <div className="hidden shrink-0 items-center gap-3 lg:flex">
      <div className={`flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 ${LABEL_BADGE}`}>
        <span className={`${LABEL_CODE} font-medium text-accent-soft`}>@{me?.handle ?? "—"}</span>
        <span className="text-[#3c494c]">|</span>
        <span className="type-label text-warn">— GLK</span>
        <span className="text-[#3c494c]">|</span>
        <span className="type-label text-accent-soft">⚡ LVL {me?.level ?? "—"}</span>
        <span className="text-[#3c494c]">|</span>
        <span className="type-label text-warn">🔥 D{me?.streak.current ?? "—"} streak</span>
      </div>
      <Link href="/settings" title="Settings" className="flex items-center justify-center rounded-lg p-1.5 text-ink-muted hover:bg-surface-raised hover:text-ink">
        <SettingsIcon className="text-[20px]" />
      </Link>
      <Link href="/profile" aria-label="Your profile" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft">
        <PersonIcon className="text-[18px] text-[#00363e]" />
      </Link>
    </div>
  );
}
