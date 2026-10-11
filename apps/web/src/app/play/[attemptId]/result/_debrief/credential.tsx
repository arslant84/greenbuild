"use client";

import type { AttemptResult } from "@greenbuild/shared";
import { useState } from "react";
import { AuthenticIcon, CredentialIcon, DownloadIcon, LinkIcon, ShareIcon, TerminalBadgeIcon } from "../../../../../ui/icons-debrief";
import { xpAmount } from "../../../xp-view";
import { checkSummary } from "./outcome";
import { formatDuration } from "./summary";

interface CredentialProps {
  result: AttemptResult;
  skills: string[];
}

// Figma › Verifiable Credential Section. Accounts, sharing and signed proofs arrive later; the card shows
// what this attempt proves and empty values for the rest. The verification link is this result page.
export function Credential({ result, skills }: CredentialProps) {
  return (
    <section className="flex flex-col gap-2 pb-8">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-ink-muted">
          <CredentialIcon />
          <span className="type-label font-medium tracking-[0.5px] uppercase">Verifiable credential &amp; social proof</span>
        </span>
        <span className="type-label rounded bg-control px-1 py-0.5 text-ink-subtle">sha256: —</span>
      </div>
      <div className="flex flex-col gap-3 rounded-xl bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between rounded-lg bg-[#201f2066] p-2 pb-3">
          <span className="flex items-center gap-2">
            <span className="font-mono text-[13px] leading-[18px] font-semibold tracking-[-0.32px] text-accent-soft">&gt;_ greenbuild</span>
            <span className="type-label text-ink-subtle">/</span>
            <span className="type-label tracking-[0.5px] text-ink-muted uppercase">Proof of incident resolution</span>
          </span>
          <span className="flex items-center gap-1 rounded bg-line px-2 py-0.5 text-ok">
            <AuthenticIcon />
            <span className="type-label">{result.status === "solved" ? "AUTHENTIC" : "UNVERIFIED"}</span>
          </span>
        </div>
        <Player result={result} />
        <ChecksRow result={result} skills={skills} />
        <div className="flex justify-between pt-1 font-mono text-[10px] leading-[18px] text-ink-subtle">
          <span>Verified by greenbuild sandbox engine</span>
          <span>Seed hidden · SHA-256: —</span>
        </div>
      </div>
      <Actions />
    </section>
  );
}

function Player({ result }: { result: AttemptResult }) {
  return (
    <div className="flex items-start justify-between">
      <span className="flex gap-2">
        <span className="flex size-12 items-center justify-center rounded-xl bg-accent-soft text-[#00363e]">
          <TerminalBadgeIcon />
        </span>
        <span className="flex flex-col">
          <span className="flex items-center gap-2">
            <span className="text-[15px] leading-[22px] font-semibold text-ink">Dev player</span>
            <span className="type-label text-ink-subtle">@—</span>
          </span>
          <span className="text-[10px] leading-3 tracking-[0.2px] text-ink-muted">—</span>
          <span className="flex items-center gap-1.5 pt-1">
            <span className={`size-1.5 rounded-full ${result.status === "solved" ? "bg-ok" : "bg-line"}`} />
            <span className={`type-label ${result.status === "solved" ? "text-ok" : "text-ink-muted"}`}>
              {result.status === "solved" ? `Solved in ${formatDuration(result.duration_ms)}` : "Not solved"}
            </span>
          </span>
        </span>
      </span>
      <span className="flex items-center gap-3">
        <Metric value={`${xpAmount(result.xp_earned)} XP`} label="REWARD" tone="text-warn" />
        <Metric value="— MMR" label="GLOBAL" tone="text-accent" />
        <span className="flex flex-col items-end rounded bg-control px-2 py-1">
          <span className="font-mono text-[13px] leading-[18px] font-semibold text-ink">—</span>
          <span className="font-mono text-[9px] leading-[18px] text-ink-subtle">STREAK</span>
        </span>
      </span>
    </div>
  );
}

function Metric({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <span className="flex flex-col items-end">
      <span className={`font-mono text-lg leading-6 font-semibold tracking-[-0.18px] ${tone}`}>{value}</span>
      <span className="type-label text-ink-subtle">{label}</span>
    </span>
  );
}

function ChecksRow({ result, skills }: CredentialProps) {
  return (
    <div className="flex items-center justify-between pt-2">
      <span className="flex gap-1.5">
        {skills.map((skill) => (
          <span key={skill} className="rounded bg-control px-2 py-0.5 font-mono text-[10px] leading-[18px] text-ink-muted">
            {skill}
          </span>
        ))}
      </span>
      <span className="flex items-center gap-2 rounded bg-surface-raised px-2 py-1">
        {result.checks.map((check, index) => (
          <span key={index} className={`size-2.5 ${check.passed ? "bg-ok" : "bg-danger"}`} />
        ))}
        <span className="type-label pl-1 font-semibold text-ink">{checkSummary(result)}</span>
      </span>
    </div>
  );
}

function Actions() {
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
  };
  return (
    <div className="flex gap-1 pt-1">
      <span className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-accent text-[#00363e] opacity-60" aria-disabled="true">
        <ShareIcon />
        <span className="type-body font-semibold">Share result</span>
      </span>
      <span className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-surface-raised text-ink opacity-60" aria-disabled="true">
        <DownloadIcon />
        <span className="type-body font-medium">Download PNG</span>
      </span>
      <button type="button" onClick={() => void copyLink()} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-surface-raised text-ink-muted">
        <LinkIcon />
        <span className="type-body font-medium">{copied ? "Link copied" : "Copy verification link"}</span>
      </button>
    </div>
  );
}
