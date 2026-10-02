import { ATTEMPT_MAX_CHECKS, type ChallengeCard } from "@greenbuild/shared";
import type { ReactNode } from "react";
import { formatClock } from "../../../../ui/format";
import { ArrowDropDownIcon, TimerCompactIcon } from "../../../../ui/icons";

const PERCENT = 100;

interface MissionPanelProps {
  card: ChallengeCard;
  remainingSeconds: number;
  checksUsed: number;
  actions: ReactNode;
}

// Figma › Aside - RIGHT PANE (360 px MISSION CONTROL PANEL).
export function MissionPanel({ card, remainingSeconds, checksUsed, actions }: MissionPanelProps) {
  return (
    <aside className="flex w-[360px] shrink-0 flex-col justify-between bg-surface-raised p-5">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 rounded bg-[#93000a33] px-2 py-1">
            <span className="size-2 rounded-full bg-danger" />
            <span className="type-label font-semibold tracking-[0.5px] text-danger">DAILY · SEV-1 INCIDENT</span>
          </span>
          <span className="type-label rounded bg-control px-2 py-0.5 font-medium text-warn">— XP</span>
        </div>
        <Brief card={card} />
        <TimerCard remainingSeconds={remainingSeconds} limitSeconds={card.time_limit_sec} />
        <ChecksCard checksUsed={checksUsed} />
      </div>
      {actions}
    </aside>
  );
}

function Brief({ card }: { card: ChallengeCard }) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-lg leading-6 font-bold tracking-[-0.45px] text-ink">{card.title}</h1>
        <p className="type-body leading-[21px] text-ink-muted">{card.statement}</p>
        <span className="flex items-center gap-0.5 text-accent-soft" aria-disabled="true">
          <span className="type-label">Read full runbook</span>
          <ArrowDropDownIcon />
        </span>
      </div>
      <div className="flex items-center gap-1">
        {card.skills.map((skill) => (
          <span key={skill} className="type-label rounded bg-control px-2 py-0.5 text-ink">
            {skill}
          </span>
        ))}
      </div>
    </>
  );
}

function TimerCard({ remainingSeconds, limitSeconds }: { remainingSeconds: number; limitSeconds: number }) {
  const runway = Math.round((Math.max(0, remainingSeconds) / limitSeconds) * PERCENT);
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-surface p-3 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1),0_4px_6px_-1px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <TimerCompactIcon className="text-warn" />
          <span className="type-label tracking-[1px] text-ink-subtle uppercase">Time remaining</span>
        </span>
        <span className="type-label text-ok">PACED</span>
      </div>
      <span className="type-term py-1 text-5xl leading-[48px] font-bold tracking-[-1.2px] text-ink">{formatClock(remainingSeconds)}</span>
      <div className="flex flex-col gap-1">
        <div className="h-1.5 rounded-full bg-line">
          <div className="h-full rounded-full bg-accent" style={{ width: `${runway}%` }} />
        </div>
        <div className="flex justify-between">
          <span className="type-label text-ink-subtle">{runway}% runway remaining</span>
          <span className="type-label text-ink-subtle">{formatClock(limitSeconds)} max</span>
        </div>
      </div>
    </section>
  );
}

// Ten checks per attempt (owner's decision, 2026-10-02): the frame's three dots become ten smaller ones.
function ChecksCard({ checksUsed }: { checksUsed: number }) {
  const left = ATTEMPT_MAX_CHECKS - checksUsed;
  return (
    <section className="flex items-center justify-between rounded-lg bg-surface p-3">
      <span className="flex flex-col">
        <span className="type-body font-medium text-ink">Checks remaining</span>
        <span className="type-label text-ink-subtle">{left} evaluation cycles left</span>
      </span>
      <span className="flex items-center gap-1">
        {Array.from({ length: ATTEMPT_MAX_CHECKS }, (_, check) => (
          <span key={check} className={`size-2 rounded-full ${check < left ? "bg-accent shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "bg-line"}`} />
        ))}
      </span>
    </section>
  );
}
