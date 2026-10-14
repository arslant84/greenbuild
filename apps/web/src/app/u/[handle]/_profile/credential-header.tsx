import type { PublicProfile } from "@greenbuild/shared";
import Link from "next/link";
import { CodeIcon, MilitaryTechIcon, ShieldIcon, VerifiedIcon, VerifiedUserIcon } from "../../../../ui/icons-profile";
import { levelRing, profileInitials, profileName, RING_CIRCUMFERENCE } from "./profile-view";
import { HEADLINE_LG, LABEL_BADGE, LABEL_CODE } from "./type";

const CHIP = `inline-flex items-center gap-1 rounded border px-2.5 py-0.5 ${LABEL_BADGE}`;

// Frame 3:4532 › credential profile header, state V5 (a visitor). Country, discovery, verification,
// rank, join date and GitHub have no public data yet and show "—"; the frame's signing-key line is not
// true for greenbuild and says how solves are checked instead. Contact has no feature yet (disabled).
export function CredentialHeader({ profile }: { profile: PublicProfile }) {
  return (
    <header className="flex items-center justify-between gap-5 border-b border-control bg-canvas px-6 py-5">
      <Identity profile={profile} />
      <div className="flex items-center gap-5">
        <LevelRing profile={profile} />
        <div className="flex items-center gap-2">
          <button type="button" disabled className={`rounded-lg border border-control px-3 py-1.5 ${LABEL_BADGE} text-ink`}>
            Sign in to contact
          </button>
          <Link href="/" className={`rounded-lg bg-accent-soft px-3.5 py-1.5 ${LABEL_BADGE} font-semibold text-[#00363e]`}>
            Join greenbuild
          </Link>
        </div>
      </div>
    </header>
  );
}

function Identity({ profile }: { profile: PublicProfile }) {
  return (
    <div className="flex items-center gap-5">
      <div className="relative flex size-24 shrink-0 items-center justify-center rounded-full border-2 border-line bg-control shadow-lg">
        <span className="font-mono text-2xl font-bold tracking-tighter text-ink">{profileInitials(profile)}</span>
        <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-control shadow-md">
          <VerifiedIcon className="text-[14px] text-ink-subtle" />
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <h1 className={`${HEADLINE_LG} text-ink`}>{profileName(profile)}</h1>
          <span className={`rounded border border-accent-soft/20 bg-accent-soft/10 px-2 py-0.5 ${LABEL_CODE} text-accent-soft`}>@{profile.handle}</span>
          <span className="type-body text-ink-muted">—</span>
        </div>
        <StatusChips />
        <div className={`flex items-center gap-3 pt-1 ${LABEL_CODE} text-ink-muted`}>
          <span className="flex items-center gap-1.5">
            <CodeIcon className="text-[15px]" />
            GitHub —
          </span>
          <span className="text-[#3c494c]">/</span>
          <span className="type-label text-ink-subtle">Solves checked in gVisor sandboxes</span>
        </div>
      </div>
    </div>
  );
}

function StatusChips() {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className={`${CHIP} border-[#a78bfa]/40 bg-[#7c3aed]/15 text-[#c4b5fd]`}>
        <span className="size-1.5 rounded-full bg-ink-subtle" />
        OPEN TO OFFERS: —
      </span>
      <span className={`${CHIP} border-accent-soft/30 bg-accent-soft/10 text-accent-soft`}>
        <VerifiedUserIcon className="text-[13px]" />
        VERIFIED STAGE —
      </span>
      <span className={`${CHIP} border-warn/40 bg-warn/10 text-warn`}>
        <MilitaryTechIcon className="text-[13px]" />
        TOP — · — (#— GLOBAL)
      </span>
      <span className="type-label text-ink-subtle">Member since —</span>
    </div>
  );
}

function LevelRing({ profile }: { profile: PublicProfile }) {
  const ring = levelRing(profile);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-control bg-surface p-2.5">
      <div className="relative flex size-14 shrink-0 items-center justify-center">
        <svg className="size-14 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
          <circle className="text-control" cx="24" cy="24" r="20" fill="transparent" stroke="currentColor" strokeWidth="3" />
          <circle
            className="text-accent-soft"
            cx="24"
            cy="24"
            r="20"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={ring.dashOffset}
          />
        </svg>
        <span className="absolute font-mono text-base leading-none font-bold text-ink">{profile.level}</span>
      </div>
      <div className="flex flex-col">
        <span className="type-label tracking-wider text-ink-subtle uppercase">Skill Level</span>
        <span className={`${LABEL_BADGE} font-semibold text-ink`}>Level {profile.level}</span>
        <span className="type-label text-ok">{ring.toNext}</span>
      </div>
    </div>
  );
}

// Frame 3:4532 › trust strip. The frame's eBPF anti-cheat claim is not true for greenbuild; it says what is.
export function TrustStrip() {
  return (
    <section className="flex items-center justify-between gap-2 border-b border-control bg-[#0a0a0c] px-6 py-2">
      <span className="flex items-center gap-2 type-label text-ink-muted">
        <ShieldIcon className="text-[15px] text-ok" />
        Ratings by Glicko-2 · Every attempt checked in its own gVisor sandbox · Companies see players only if they opt in
      </span>
      <span className="flex items-center gap-1.5 type-label text-ink-muted">
        <span className="size-1.5 rounded-full bg-ok" />
        Public profile · read-only
      </span>
    </section>
  );
}
