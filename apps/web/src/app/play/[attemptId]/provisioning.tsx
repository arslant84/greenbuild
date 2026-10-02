"use client";

import type { ChallengeCard } from "@greenbuild/shared";
import { formatClock } from "../../../ui/format";
import { InfoIcon, TerminalMiniIcon, TimerMiniIcon } from "../../../ui/icons";
import { useNow } from "../../../ui/use-now";

const DIFFICULTY_STEPS = 10;
const MS_PER_SECOND = 1_000;
const BORDER = "border-[#3c494c4d]";

interface ProvisioningProps {
  card: ChallengeCard;
  attemptId: string;
  createdAt: string;
}

// Figma "Sandbox Provisioning & MicroVM Initializer" (7:11835). The engine reports only "starting"
// and "ready", so the card shows the elapsed time instead of per-step progress.
export function Provisioning({ card, attemptId, createdAt }: ProvisioningProps) {
  const elapsed = Math.max(0, Math.round((useNow() - Date.parse(createdAt)) / MS_PER_SECOND));
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#131314] p-4">
      <div className={`flex w-[560px] flex-col gap-4 rounded-xl border ${BORDER} bg-canvas p-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]`}>
        <header className="flex items-center justify-between border-b border-[#3c494c33] pb-1">
          <a href="/play" className="type-label flex items-center gap-1.5 text-ink-muted">
            <span className="text-[#bbc9cdb2]">←</span> Return to Daily Challenge
          </a>
          <span className="flex items-center gap-2">
            <span className="type-label flex items-center gap-1 rounded bg-surface-raised px-2 py-0.5">
              <span className="font-semibold text-accent-soft">&gt;_</span>
              <span className="text-[11px] text-ink-muted">greenbuild #{attemptId.slice(0, 4)}</span>
            </span>
            <span className="type-label flex items-center gap-1.5 rounded bg-surface-raised px-2 py-0.5 text-ink-muted">
              <span className="size-1.5 rounded-full bg-line" />— // —ms
            </span>
          </span>
        </header>
        <StartLog />
        <Progress elapsed={elapsed} />
        <ChallengePreview card={card} />
        <Tip />
        <footer className="type-label border-t border-[#3c494c33] pt-1 text-[10.5px] text-[#bbc9cdcc]">Taking longer than expected? Contact support</footer>
      </div>
    </div>
  );
}

function StartLog() {
  return (
    <section className={`overflow-hidden rounded-lg border ${BORDER} bg-[#0b0b0c] shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]`}>
      <div className="flex h-[35px] items-center justify-between border-b border-[#ffffff0d] bg-[#171718] px-3 py-2">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full border border-[#e0443e66] bg-[#ff5f56cc]" />
          <span className="size-2.5 rounded-full border border-[#dea12366] bg-[#ffbd2ecc]" />
          <span className="size-2.5 rounded-full border border-[#1aab2966] bg-[#27c93fcc]" />
        </span>
        <span className="flex items-center gap-1.5 text-accent-soft">
          <TerminalMiniIcon />
          <span className="type-label tracking-[-0.25px] text-[#bbc9cdcc]">greenbuild-sandbox-session</span>
        </span>
        <span className="font-mono text-[10px] leading-[18px] text-[#bbc9cd80]">sh (tty1)</span>
      </div>
      <div className="flex h-[188px] flex-col gap-1 p-3.5 font-mono text-[12.5px] leading-5">
        <p>
          <span className="font-semibold text-accent-soft">$</span> <span className="font-semibold text-ink">greenbuild sandbox create</span>
        </p>
        <p className="font-medium text-accent-soft">
          → Starting sandbox… <span className="font-semibold">[in progress]</span>
          <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-accent-soft align-middle" />
        </p>
        <p className="text-[#bbc9cd80]">→ Ready [waiting]</p>
      </div>
    </section>
  );
}

function Tip() {
  return (
    <section className="flex flex-col items-center gap-1.5 py-0.5">
      <p className="px-3 py-0.5 font-mono text-[11px] leading-[18px] text-[#bbc9cde5]">
        <span className="pr-1 text-accent-soft">✦</span>Tip: Press Cmd+Enter to check your solution.
      </p>
      <span className="flex gap-1.5">
        <span className="size-1.5 rounded-full bg-accent-soft" />
        <span className="size-1.5 rounded-full bg-line" />
        <span className="size-1.5 rounded-full bg-line" />
      </span>
    </section>
  );
}

function Progress({ elapsed }: { elapsed: number }) {
  return (
    <section className="flex flex-col gap-2 pt-0.5">
      <div className="h-1.5 overflow-hidden rounded-full bg-[#27272a]">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
      </div>
      <div className="flex items-center justify-between">
        <span className="type-label flex gap-1.5">
          <span className="font-medium text-ink">{formatClock(elapsed)}</span>
          <span className="text-ink-muted">·</span>
          <span className="text-ink-muted">Usually ready in under 20 seconds</span>
        </span>
        <span className="flex items-center gap-1.5 text-accent-soft">
          <span className="size-1.5 rounded-full bg-accent-soft" />
          <span className="type-label">Starting sandbox</span>
        </span>
      </div>
    </section>
  );
}

function ChallengePreview({ card }: { card: ChallengeCard }) {
  return (
    <section className={`flex flex-col gap-2.5 rounded-lg border border-[#3c494c40] bg-surface p-3.5`}>
      <div className="flex justify-between">
        <div className="flex flex-col gap-px">
          <span className="flex items-center gap-2">
            <span className="text-base leading-[18px] font-semibold tracking-[-0.4px] text-ink">{card.title}</span>
            <span className="type-label pr-1 font-medium text-ink-muted">Difficulty:</span>
            <span className="text-[11px] leading-[18px]">
              <span className="text-warn">{"●".repeat(card.difficulty)}</span>
              <span className="text-[#3c494c99]">{"○".repeat(DIFFICULTY_STEPS - card.difficulty)}</span>
            </span>
          </span>
          <span className="type-body text-ink-muted">{card.statement}</span>
        </div>
        <span className="flex flex-col items-end">
          <span className={`flex items-center gap-1 rounded border ${BORDER} bg-surface-raised px-2 py-0.5 text-accent-soft`}>
            <TimerMiniIcon />
            <span className="font-mono text-xs leading-[18px] font-semibold tracking-[0.6px] text-ink">{formatClock(card.time_limit_sec)}</span>
          </span>
          <span className="pt-0.5 font-mono text-[9.5px] leading-[18px] text-[#bbc9cdb2]">time limit</span>
        </span>
      </div>
      <div className="flex flex-col gap-2 border-t border-[#3c494c33] pt-1">
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] leading-[18px] text-ink-muted">Skills:</span>
          {card.skills.map((skill) => (
            <span key={skill} className={`rounded border ${BORDER} bg-surface-raised px-2 py-0.5 font-mono text-[10px] leading-[18px] text-ink`}>
              {skill}
            </span>
          ))}
        </span>
        <span className="flex items-center gap-1 text-ok">
          <InfoIcon />
          <span className="font-mono text-[10.5px] leading-[18px] text-[#bbc9cdcc]">The timer starts when the terminal is ready.</span>
        </span>
      </div>
    </section>
  );
}
