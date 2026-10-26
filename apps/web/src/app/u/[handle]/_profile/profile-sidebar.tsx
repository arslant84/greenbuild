import type { PublicProfile } from "@greenbuild/shared";
import type { ReactNode } from "react";
import { CalculateIcon, CorporateFareIcon, HistoryIcon, LocalFireDepartmentIcon, LockPersonIcon, SecurityIcon, VerifiedIcon } from "../../../../ui/icons-profile";
import { plural } from "./profile-view";
import { CARD, LABEL_BADGE } from "./type";

// The frame's attendance grid: 12 columns, 3 rows.
const ATTENDANCE_DAYS = Array.from({ length: 36 }, (_, day) => `day-${day}`);

// Frame 3:4532 › right column, state V5. The streak is real; freezes and day-by-day attendance are not in
// the public profile yet ("—", empty days). The frame's claims about microVM logs, eBPF tracing, percentiles
// and a Merkle snapshot are not true for greenbuild and say what is; company accounts do not exist yet.
export function ProfileSidebar({ profile }: { profile: PublicProfile }) {
  return (
    <aside className="flex flex-col gap-5 lg:col-span-4">
      <StreakCard profile={profile} />
      <TrustCard />
      <HiringCard />
      <Provenance />
    </aside>
  );
}

function TrustCard() {
  return (
    <section className={`${CARD} gap-3`}>
      <div className="flex items-center gap-2 border-b border-control pb-2">
        <VerifiedIcon className="text-[20px] text-accent-soft" />
        <h3 className="text-[15px] leading-5.5 font-semibold text-ink">Why This Profile Matters</h3>
      </div>
      <div className="flex flex-col gap-3 type-body text-ink-muted">
        <Reason icon={<CalculateIcon className="text-[17px] text-accent-soft" />} title="Glicko-2 ratings:">
          Every finished attempt is rated against the challenge; nothing is self-reported.
        </Reason>
        <Reason icon={<SecurityIcon className="text-[17px] text-accent-soft" />} title="Sandboxed checks:">
          Each attempt runs in its own isolated gVisor sandbox, and the challenge&apos;s check decides whether the fix holds.
        </Reason>
        <Reason icon={<LockPersonIcon className="text-[17px] text-[#a78bfa]" />} title="Consent-first discovery:">
          Companies see a player only after the player turns discovery on.
        </Reason>
      </div>
    </section>
  );
}

function HiringCard() {
  return (
    <section className={`${CARD} gap-3`}>
      <div className="flex items-center gap-2 text-accent-soft">
        <CorporateFareIcon className="text-[22px]" />
        <h3 className="text-[15px] leading-5.5 font-semibold text-ink">Hiring Infrastructure Talent?</h3>
      </div>
      <p className="type-body text-ink-muted">Company accounts are not open yet. They will reach players who opt in to discovery.</p>
      <div className="flex flex-col gap-2 pt-1">
        <button type="button" disabled className={`w-full rounded-lg bg-accent-soft px-4 py-2.5 ${LABEL_BADGE} font-semibold text-[#00363e] opacity-60`}>
          Create Enterprise Account
        </button>
        <span className="text-center type-label text-ink-subtle">Ratings come from solved incidents, not résumés.</span>
      </div>
    </section>
  );
}

function Provenance() {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-control bg-canvas p-3 type-label text-ink-subtle">
      <span className="flex items-center gap-1.5">
        <HistoryIcon className="text-[14px]" />
        PROVENANCE
      </span>
      <p>
        Rated by: <span className="font-mono text-accent-soft">greenbuild · Glicko-2</span>
      </p>
      <p>
        Profile snapshot: <span className="font-mono text-ink">—</span>
      </p>
    </div>
  );
}

function StreakCard({ profile }: { profile: PublicProfile }) {
  return (
    <section className={`${CARD} gap-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LocalFireDepartmentIcon className="text-[24px] text-warn" />
          <div>
            <span className="block type-label text-ink-subtle uppercase">Current Momentum</span>
            <span className="text-2xl leading-tight font-bold text-ink">Day {profile.streak.current}</span>
          </div>
        </div>
        <div className="text-right type-label">
          <span className="block text-ink">Longest: {plural(profile.streak.longest, "day")}</span>
          <span className="font-medium text-warn">— freezes available</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 pt-2">
        <div className="flex items-center justify-between type-label text-ink-subtle">
          <span>90-DAY ATTENDANCE</span>
          <span className="text-ok">— Active</span>
        </div>
        <div className="grid grid-cols-12 gap-1.5 rounded-lg bg-surface p-2.5">
          {ATTENDANCE_DAYS.map((day) => (
            <span key={day} className="size-3.5 rounded-sm bg-control" />
          ))}
        </div>
        <div className="flex items-center justify-between pt-1 font-mono text-[11px] text-ink-subtle">
          <Legend color="bg-accent-soft">Solved</Legend>
          <Legend color="bg-warn">Freeze used</Legend>
          <Legend color="bg-control">Rest</Legend>
        </div>
      </div>
      <p className="type-body text-ink-muted italic">A day counts when the player solves any challenge that day.</p>
    </section>
  );
}

function Reason({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>
        <strong className="text-ink">{title}</strong> {children}
      </p>
    </div>
  );
}

function Legend({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`size-2 rounded-sm ${color}`} />
      {children}
    </span>
  );
}
