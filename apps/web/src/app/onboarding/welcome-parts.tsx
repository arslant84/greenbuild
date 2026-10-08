import type { ReactNode } from "react";
import { ConsoleIcon, OptInKeyIcon, VerifiedShieldIcon } from "../../ui/icons-onboarding";

// Figma's wording, changed only where it is not true for greenbuild (owner, 2026-10-08): the topics are
// the catalog's, and the rating is the Glicko-2 rating of solved incidents.
const VALUE_PROPS: { icon: ReactNode; color: string; title: string; text: string }[] = [
  { icon: <ConsoleIcon />, color: "text-accent-soft", title: "Daily live challenges", text: "Linux permissions, nginx and TLS, PostgreSQL, Redis, stuck ports and resource limits." },
  { icon: <VerifiedShieldIcon />, color: "text-ok", title: "Verified skill ratings (Glicko-2)", text: "A rating built from the incidents you actually resolve, and how fast." },
  { icon: <OptInKeyIcon />, color: "text-warn", title: "Zero spam recruiter reachouts", text: "Get discovered by engineering teams solely if you explicitly opt-in to hireable leaderboard flags." },
];

// Figma › Left Column: Value Prop.
export function ValueProps() {
  return (
    <ul className="flex flex-col gap-3">
      {VALUE_PROPS.map((prop) => (
        <li key={prop.title} className="flex gap-2">
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-raised ${prop.color}`}>{prop.icon}</span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] leading-[22px] font-medium text-ink">{prop.title}</span>
            <span className="type-body text-ink-subtle">{prop.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// Figma › Right Column: MicroVM Terminal Preview. The lines describe the real sandbox: a gVisor
// container with 512 MB, half a CPU and no network.
export function TerminalPreview() {
  return (
    <div className="flex w-[328px] flex-col self-center rounded-lg bg-canvas p-3 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between pb-2">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#ffb4abb2]" />
          <span className="size-2.5 rounded-full bg-[#ffc640b2]" />
          <span className="size-2.5 rounded-full bg-[#64f88ab2]" />
        </span>
        <span className="type-label text-ink-subtle">gvisor</span>
      </div>
      <div className="flex flex-col gap-1.5 font-mono text-[13px] leading-[21px]">
        <span className="text-accent-soft">$ greenbuild init --profile @you</span>
        <span className="text-[#3c494c]">[info] allocating ephemeral sandbox</span>
        <span className="text-ok">[ready] environment prepared</span>
        <span className="text-warn">[hint] incident: nginx 502 bad gateway</span>
        <span className="flex items-center pt-2 text-accent-soft">
          you@sandbox:~$
          <span className="ml-1 h-4 w-2 bg-accent" />
        </span>
      </div>
      <div className="type-label mt-3 flex justify-between rounded bg-control/40 p-1 text-ink-subtle">
        <span>MEM: 512MB</span>
        <span>CPU: 0.5 vCPU</span>
        <span className="text-ok">NET: NONE</span>
      </div>
    </div>
  );
}
