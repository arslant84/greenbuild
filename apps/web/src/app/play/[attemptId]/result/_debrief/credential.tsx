"use client";

import type { AttemptResult } from "@greenbuild/shared";
import { AuthenticIcon, CredentialIcon, TerminalBadgeIcon } from "../../../../../ui/icons-debrief";
import { playerNames } from "../../../../s/[token]/share-view";
import { xpAmount } from "../../../xp-view";
import { checkSummary } from "./outcome";
import { ShareActions } from "./share-actions";
import { formatDuration } from "./summary";

interface CredentialProps {
  result: AttemptResult;
  skills: string[];
  // The player's current streak, or null when the profile could not be read.
  streak: number | null;
  // The player's names as their profile has them, or null when it could not be read.
  player: { display_name: string | null; handle: string | null } | null;
}

// Figma › Verifiable Credential Section. The card shows what this attempt proves, with empty values for what
// does not exist yet (MMR, signed proofs); its share link is public (task 51).
export function Credential({ result, skills, streak, player }: CredentialProps) {
  return (
    <section id="credential" className="flex scroll-mt-20 flex-col gap-2 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-ink-muted">
          <CredentialIcon />
          <span className="type-label font-medium tracking-[0.5px] uppercase">Verifiable credential &amp; social proof</span>
        </span>
        <span className="type-label rounded bg-control px-1 py-0.5 text-ink-subtle">sha256: —</span>
      </div>
      <div className="flex flex-col gap-3 rounded-xl bg-surface p-4 lg:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#201f2066] p-2 pb-3">
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
        <Player result={result} streak={streak} player={player} />
        <ChecksRow result={result} skills={skills} />
        <div className="flex flex-col gap-1 pt-1 font-mono text-[10px] leading-[18px] text-ink-subtle sm:flex-row sm:justify-between">
          <span>Verified by greenbuild sandbox engine</span>
          <span>Seed hidden · SHA-256: —</span>
        </div>
      </div>
      <ShareActions attemptId={result.id} solved={result.status === "solved"} />
    </section>
  );
}

function Player({ result, streak, player }: Pick<CredentialProps, "result" | "streak" | "player">) {
  const names = player ? playerNames(player) : { name: "—", handle: null };
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <span className="flex gap-2">
        <span className="flex size-12 items-center justify-center rounded-xl bg-accent-soft text-[#00363e]">
          <TerminalBadgeIcon />
        </span>
        <span className="flex flex-col">
          <span className="flex items-center gap-2">
            <span className="text-[15px] leading-[22px] font-semibold text-ink">{names.name}</span>
            {names.handle && <span className="type-label text-ink-subtle">{names.handle}</span>}
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
          <span className="font-mono text-[13px] leading-[18px] font-semibold text-ink">{xpAmount(streak)}</span>
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

function ChecksRow({ result, skills }: Pick<CredentialProps, "result" | "skills">) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
      <span className="flex flex-wrap gap-1.5">
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

