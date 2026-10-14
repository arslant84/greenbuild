import Link from "next/link";
import { PersonIcon } from "../../../../ui/icons-profile";
import { LABEL_BADGE, LABEL_CODE } from "./type";

const CURRENT = "rounded bg-control px-2 py-1 type-body font-medium text-accent-soft";
const OTHER = `rounded px-2 py-1 ${LABEL_CODE} text-ink-muted`;

// Frame 3:4532 › header. "Profile" is the viewer's own profile when signed in, else this page.
// Candidates/Marketplace has no page yet, so it is text; the recruiter/engineer switch and the latency
// chip have no data and show disabled and "—".
export function ProfileTopNav({ ownHref }: { ownHref: string | null }) {
  return (
    <header className="flex h-14 items-center justify-between bg-[#131314e6] px-6 shadow-[0_1px_8px_rgba(0,0,0,0.4)] backdrop-blur-md">
      <div className="flex items-center gap-5">
        <Link href="/" className="flex items-center gap-2">
          <span className={`${LABEL_CODE} font-medium tracking-tight text-accent-soft`}>&gt;_ greenbuild</span>
          <span className="flex items-center gap-1 rounded bg-control px-1 py-0.5">
            <span className="size-1.5 animate-pulse rounded-full bg-ok" />
            <span className="type-label text-ok uppercase">beta</span>
          </span>
        </Link>
        <NavLinks ownHref={ownHref} />
      </div>
      <ViewerControls />
    </header>
  );
}

function NavLinks({ ownHref }: { ownHref: string | null }) {
  return (
    <nav className="flex items-center gap-1">
      {ownHref ? (
        <Link href={ownHref} aria-current="page" className={CURRENT}>
          Profile
        </Link>
      ) : (
        <span aria-current="page" className={CURRENT}>
          Profile
        </span>
      )}
      <Link href="/challenges" className={OTHER}>
        Challenges
      </Link>
      <Link href="/leaderboard" className={OTHER}>
        Leaderboards
      </Link>
      <span className={OTHER}>Candidates/Marketplace</span>
    </nav>
  );
}

function ViewerControls() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1 rounded bg-canvas p-1">
        <button type="button" disabled className={`rounded px-2 py-0.5 ${LABEL_BADGE} text-ink-muted`}>
          RECRUITER
        </button>
        <button type="button" disabled className={`rounded px-2 py-0.5 ${LABEL_BADGE} text-ink-muted`}>
          ENGINEER
        </button>
      </span>
      <span className="flex items-center gap-1 rounded bg-surface px-2 py-1">
        <span className="size-2 rounded-full bg-ink-subtle" />
        <span className={`${LABEL_BADGE} text-ink-muted`}>STABLE: —</span>
      </span>
      <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft">
        <PersonIcon className="text-[18px] text-[#00363e]" />
      </span>
    </div>
  );
}
