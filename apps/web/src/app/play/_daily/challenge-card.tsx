import type { ChallengeCard as Card } from "@greenbuild/shared";
import { formatClock } from "../../../ui/format";
import { DeployedCodeIcon, TimerIcon } from "../../../ui/icons";
import { StartButton } from "./start-button";

const DIFFICULTY_STEPS = 10;

// Figma › Section - PRIMARY CHALLENGE CARD (HERO ELEMENT); blocked while another attempt runs (task 21b).
export function ChallengeCard({ card, blocked }: { card: Card; blocked: boolean }) {
  return (
    <section className="relative flex flex-col gap-3 rounded-xl bg-surface-raised p-5 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1),0_4px_6px_-1px_rgba(0,0,0,0.1)]">
      <span className="absolute -top-px left-1 h-0.5 w-[calc(100%-8px)] bg-[linear-gradient(90deg,rgba(34,211,238,0)_0%,rgba(34,211,238,0.8)_50%,rgba(34,211,238,0)_100%)]" />
      <div className="flex h-4 items-center justify-between">
        <span className="flex items-center gap-1">
          <span className="type-label font-semibold tracking-[2px] text-ink-muted uppercase">Today&apos;s challenge</span>
          <span className="size-1.5 rounded-full bg-accent" />
        </span>
        <span className="type-label rounded bg-control px-2 py-0.5 text-[#2fd9f4]">SEV-1 SIMULATION</span>
      </div>
      <div className="flex flex-col gap-0.75">
        <h1 className="text-[32px] leading-10 font-bold tracking-[-0.8px] text-ink">{card.title}</h1>
        <p className="text-[15px] leading-6 text-ink-muted">{card.statement}</p>
      </div>
      <MetadataRow card={card} />
      <TerminalPreview slug={card.slug} />
      <StartButton challengeSlug={card.slug} blocked={blocked} />
    </section>
  );
}

function MetadataRow({ card }: { card: Card }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="flex items-center gap-1 rounded-md bg-canvas px-2 py-1">
        <span className="type-label text-ink-muted">Difficulty:</span>
        <span className="flex items-center gap-1">
          {Array.from({ length: DIFFICULTY_STEPS }, (_, step) => (
            <span key={step} className={`size-2 rounded-full ${step < card.difficulty ? "bg-warn" : "bg-line"}`} />
          ))}
        </span>
        <span className="type-label pl-1 font-medium text-warn">
          {card.difficulty}/{DIFFICULTY_STEPS}
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        {card.skills.map((skill) => (
          <span key={skill} className="type-label rounded bg-line px-2.5 py-1 text-ink-muted">
            {skill}
          </span>
        ))}
      </span>
      <span className="flex items-center gap-1 rounded-md bg-canvas px-2 py-1">
        <TimerIcon width={11} height={13} className="text-ink-muted" />
        <span className="type-label font-medium text-ink">{formatClock(card.time_limit_sec)}</span>
      </span>
      <span className="flex items-center gap-1 text-ink-muted">
        <DeployedCodeIcon />
        <span className="type-label">1 pod · ephemeral sandbox · root shell</span>
      </span>
    </div>
  );
}

// The Figma preview shows sample output; until challenges ship a teaser, it shows the prompt only.
function TerminalPreview({ slug }: { slug: string }) {
  return (
    <div className="flex h-26.25 flex-col gap-1.5 rounded-lg bg-canvas p-3 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
      <div className="flex h-4 items-center gap-1.5 pb-1">
        <span className="size-2.5 rounded-full bg-danger" />
        <span className="size-2.5 rounded-full bg-warn" />
        <span className="size-2.5 rounded-full bg-ok" />
        <span className="type-label pl-2 text-ink-muted">sandbox-env // {slug}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[13px] leading-4.5 font-semibold text-accent">$</span>
        <span className="h-4 w-2 animate-pulse bg-ink-muted" />
      </div>
    </div>
  );
}
