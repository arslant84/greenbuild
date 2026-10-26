"use client";

import type { AttemptResponse, ChallengeCard } from "@greenbuild/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlagIcon, PlayIcon, TimerCompactIcon } from "../../../ui/icons";
import { useNow } from "../../../ui/use-now";
import { useSubmitShortcut } from "../../../ui/use-shortcut";
import { useLeave } from "../[attemptId]/_sandbox/use-leave";
import { activeAttemptFacts } from "./active-attempt";

// Stitch "Hotfix — Daily Challenge (Attempt In Progress)" › the running attempt's card (task 21b; owner,
// 2026-10-23: missing frames come from Stitch). Resume opens its sandbox; Give up ends it, as in the sandbox.
export function ActiveAttemptCard({ attempt, card }: { attempt: AttemptResponse; card: ChallengeCard }) {
  const router = useRouter();
  const { giveUp } = useLeave(attempt.id);
  const facts = activeAttemptFacts(attempt, card.time_limit_sec, useNow());
  const sandbox = `/play/${attempt.id}`;
  useSubmitShortcut(() => router.push(sandbox), true);
  return (
    <section
      aria-label="Attempt in progress"
      className="flex flex-col items-start justify-between gap-3 rounded-xl lg:flex-row lg:items-center border border-l-2 border-[#3c494c4d] border-l-accent bg-surface-raised p-3 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1),0_4px_6px_-1px_rgba(0,0,0,0.1)]"
    >
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="size-2 animate-pulse rounded-full bg-accent" />
          <span className="type-label font-semibold tracking-[0.5px] text-accent-soft uppercase">Attempt in progress</span>
        </span>
        <h2 className="text-lg leading-6 font-bold tracking-[-0.45px] text-ink">{card.title}</h2>
        <span className="type-label flex flex-wrap items-center gap-1 text-ink-muted">
          <span className="flex items-center gap-1">
            <TimerCompactIcon />
            {facts.timeLeft}
          </span>
          <span className="text-ink-muted/40">·</span>
          <span>{facts.checks}</span>
          <span className="text-ink-muted/40">·</span>
          <span>{facts.started}</span>
        </span>
      </div>
      <AttemptActions sandbox={sandbox} onGiveUp={giveUp} />
    </section>
  );
}

function AttemptActions({ sandbox, onGiveUp }: { sandbox: string; onGiveUp: () => void }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <Link href={sandbox} className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 font-semibold text-on-accent shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-[#a2eeff]">
        <PlayIcon />
        <span>Resume attempt</span>
        <span className="type-label ml-1 rounded bg-black/20 px-1.5 py-0.5 opacity-70">⌘ + ↵</span>
      </Link>
      <button type="button" onClick={onGiveUp} className="type-label flex cursor-pointer items-center gap-1.5 rounded px-3 py-2 text-ink-muted hover:bg-control hover:text-danger">
        <FlagIcon />
        <span>Give up</span>
      </button>
    </div>
  );
}
