"use client";

import Link from "next/link";
import { ATTEMPT_MAX_CHECKS } from "@greenbuild/shared";
import { useState } from "react";
import { formatClock } from "../../../../../ui/format";
import { ArrowBackIcon, ArrowForwardIcon, CopyIcon, ScorecardIcon, VerifiedIcon } from "../../../../../ui/icons";

interface SolvedPanelProps {
  attemptId: string;
  solvedInSeconds: number;
  checksUsed: number;
}

// Figma "Hotfix Sandbox — V3 Solved State" › right panel, inside V1's 360 px panel. XP, rating and
// streaks arrive with the game layer, so their boxes show empty values.
export function SolvedPanel({ attemptId, solvedInSeconds, checksUsed }: SolvedPanelProps) {
  const resultUrl = `/play/${attemptId}/result`;
  const scorecard = [`greenbuild #${attemptId.slice(0, 8)} ⚡ ${formatClock(solvedInSeconds)}`, `${checksUsed}/${ATTEMPT_MAX_CHECKS} checks used`];
  return (
    <aside className="flex w-[360px] shrink-0 flex-col bg-surface">
      <div className="bg-surface-raised p-3">
        <div className="flex items-center justify-between rounded-lg bg-control px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <span className="flex items-center gap-1 text-ok">
            <VerifiedIcon />
            <span className="font-mono text-[13px] leading-[18px] font-semibold tracking-[-0.32px]">INCIDENT RESOLVED IN {formatClock(solvedInSeconds)}</span>
          </span>
          <span className="type-label rounded bg-canvas px-2 py-0.5 font-semibold tracking-[0.5px] text-warn uppercase">Sev-1 fixed</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-5 p-5">
        <Bounty solvedInSeconds={solvedInSeconds} />
        <Scorecard lines={scorecard} resultUrl={resultUrl} />
        <Link href="/play" className="flex items-center justify-center gap-1.5 pt-1 text-ink-muted">
          <ArrowBackIcon />
          <span className="font-mono text-[13px] leading-[18px]">Return to Daily Hub</span>
        </Link>
      </div>
    </aside>
  );
}

function Bounty({ solvedInSeconds }: { solvedInSeconds: number }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-canvas p-5 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)]">
      <div className="flex justify-between">
        <span className="flex flex-col gap-0.5">
          <span className="type-label tracking-[0.5px] text-ink-subtle uppercase">Awarded bounty</span>
          <span className="font-mono text-[32px] leading-10 font-semibold tracking-[-0.8px] text-warn">— XP</span>
        </span>
        <span className="flex flex-col items-end">
          <span className="type-label tracking-[0.5px] text-ink-subtle uppercase">Rank impact</span>
          <span className="font-mono text-lg leading-6 font-semibold text-ok">—</span>
        </span>
      </div>
      <div className="flex gap-2 pt-1">
        <Metric label="ELAPSED TIME" value={formatClock(solvedInSeconds)} tone="text-ink" />
        <Metric label="DEPLOY STREAK" value="—" tone="text-warn" />
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span className="flex flex-1 flex-col gap-0.5 rounded-lg bg-surface p-2">
      <span className="type-label text-ink-muted">{label}</span>
      <span className={`font-mono text-lg leading-6 font-semibold tracking-[-0.18px] ${tone}`}>{value}</span>
    </span>
  );
}

function Scorecard({ lines, resultUrl }: { lines: string[]; resultUrl: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => void navigator.clipboard.writeText(lines.join("\n")).then(() => setCopied(true));
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface-raised p-3 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)]">
      <span className="flex items-center gap-1.5 text-accent-soft">
        <ScorecardIcon />
        <span className="font-mono text-[13px] leading-[18px] font-semibold text-ink">Incident Scorecard</span>
      </span>
      <div className="flex flex-col gap-1 rounded-lg bg-canvas p-3 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
        <span className="font-mono text-[13px] leading-[18px] font-semibold text-accent-soft">{lines[0]}</span>
        <span className="font-mono text-[13px] leading-[18px] text-ok">{lines[1]}</span>
        <a href={resultUrl} className="type-label text-ink-subtle underline">
          {resultUrl}
        </a>
      </div>
      <button type="button" onClick={copy} className="flex h-10 items-center justify-center gap-1 rounded-lg bg-accent text-[#131314]">
        <CopyIcon />
        <span className="font-mono text-[13px] leading-[18px] font-semibold">{copied ? "Copied" : "Copy Scorecard"}</span>
      </button>
      <Link href={resultUrl} className="flex h-9 items-center justify-center rounded-lg bg-control shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <span className="font-mono text-[13px] leading-[18px] text-ink">Share on X / LinkedIn</span>
      </Link>
      <span className="flex h-9 items-center justify-center gap-1 text-accent-soft opacity-60" aria-disabled="true">
        <span className="font-mono text-[13px] leading-[18px]">View Community Solutions</span>
        <ArrowForwardIcon width={11} height={11} />
      </span>
    </section>
  );
}
