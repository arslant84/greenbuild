"use client";

import Link from "next/link";
import { ResumeIcon, RetryIcon, ReviewIcon, StartArrowIcon } from "../../../ui/icons-catalog";
import { useStartAttempt } from "../../play/_daily/use-start-attempt";
import type { CardAction } from "./card-labels";

const SHAPE = "flex h-[30px] items-center gap-1 rounded px-3 font-mono text-[13px] leading-[18px] font-semibold";
const LOOKS = {
  start: `${SHAPE} bg-accent-soft text-[#00363e] shadow-[0_1px_2px_rgba(0,0,0,0.05)]`,
  retry: `${SHAPE} bg-control text-ink`,
  resume: `${SHAPE} bg-accent text-[#005763]`,
  review: `${SHAPE} bg-control text-ink`,
};

// Figma › catalog card Button: Start, Retry, Resume or Review, by the player's progress.
export function CardButton({ action }: { action: CardAction }) {
  if ("href" in action) {
    return (
      <Link href={action.href} className={LOOKS[action.kind]}>
        {action.kind === "resume" ? "Resume" : "Review"}
        {action.kind === "resume" ? <ResumeIcon /> : <ReviewIcon />}
      </Link>
    );
  }
  return <StartButton kind={action.kind} slug={action.slug} />;
}

function StartButton({ kind, slug }: { kind: "start" | "retry"; slug: string }) {
  const { start, starting, error } = useStartAttempt(slug);
  return (
    <span className="flex flex-col items-end gap-1">
      <button type="button" onClick={() => void start()} disabled={starting} className={`${LOOKS[kind]} disabled:opacity-70`}>
        {starting ? "Starting…" : kind === "start" ? "Start" : "Retry"}
        {kind === "start" ? <StartArrowIcon /> : <RetryIcon />}
      </button>
      {error && (
        <span role="alert" className="type-label max-w-[200px] text-right text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
