import type { ReactNode } from "react";
import { TerminalBadgeIcon } from "../../../ui/icons-debrief";
import type { ShareView } from "./share-view";

const LABEL = "font-mono text-[10px] leading-4 tracking-[1px] text-ink-subtle uppercase";
const BOX = "rounded-lg border border-line/40 bg-control/40 p-3";

// Stitch "Greenbuild — Public Shared Result" › the proof card (task 51), as the debrief draws it, without the
// numbers a visitor should not see (seed, hash) and those that do not exist (MMR).
export function ShareCard({ view, passed, used }: { view: ShareView; passed: number; used: number }) {
  return (
    <section aria-label="Proof of incident resolution" className="relative w-full overflow-hidden rounded-xl border border-line bg-[#121215] p-5 shadow-2xl">
      <span className="absolute inset-x-0 top-0 h-[1.5px] bg-[linear-gradient(90deg,transparent,rgba(100,248,138,0.6),transparent)]" />
      <div className="mb-3 flex items-center justify-between border-b border-line/60 pb-3">
        <span className="flex items-center gap-2 font-mono text-[11px] leading-4">
          <span className="font-bold text-ok">&gt;_ greenbuild</span>
          <span className="text-[#3c494c]">/</span>
          <span className="font-medium tracking-[1px] text-ink-muted uppercase">Proof of incident resolution</span>
        </span>
        <Badge>AUTHENTIC</Badge>
      </div>
      <Player view={view} />
      <div className={`${BOX} mb-3 border-line/60 bg-control/60`}>
        <span className={LABEL}>Incident scenario</span>
        <h1 className="text-lg leading-6 font-semibold tracking-[-0.45px] text-white">{view.title}</h1>
      </div>
      <Metrics view={view} passed={passed} used={used} />
      <div className="mb-3 flex flex-wrap gap-1.5 pt-1">
        {view.skills.map((skill) => (
          <span key={skill} className="rounded border border-line bg-line px-2 py-0.5 font-mono text-[11px] text-ink-muted">
            {skill}
          </span>
        ))}
      </div>
      <p className="border-t border-line/60 pt-3 font-mono text-[11px] text-ink-subtle">
        <span className="font-semibold text-white">greenbuild</span> · verified in an isolated sandbox
      </p>
    </section>
  );
}

function Metrics({ view, passed, used }: { view: ShareView; passed: number; used: number }) {
  return (
    <div className="mb-3 grid grid-cols-3 gap-2">
      <Metric label="Reward">
        <span className="font-mono text-[26px] leading-9 font-bold text-warn">{view.xp}</span>
      </Metric>
      <Metric label="Verification">
        <span className="flex gap-1.5 py-2.5">
          {Array.from({ length: used }, (_, check) => (
            <span key={check} className={`size-3.5 rounded-sm ${check < passed ? "bg-ok shadow-[0_0_8px_rgba(100,248,138,0.4)]" : "bg-danger"}`} />
          ))}
        </span>
        <span className="font-mono text-[11px] font-medium text-ok">{view.checks}</span>
      </Metric>
      <Metric label="Active streak">
        <span className="font-mono text-[26px] leading-9 font-bold text-white">{view.streak}</span>
      </Metric>
    </div>
  );
}

function Player({ view }: { view: ShareView }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-line bg-control text-accent">
          <TerminalBadgeIcon />
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[17px] leading-6 font-semibold text-white">{view.name}</span>
          {view.handle && <span className="type-label text-ink-subtle">{view.handle}</span>}
        </span>
      </span>
      <span className="flex items-center gap-1.5 rounded-md border border-ok/25 bg-ok/10 px-2.5 py-1 font-mono text-xs font-semibold text-ok">
        <span className="size-1.5 animate-pulse rounded-full bg-ok" />
        {view.solvedIn}
      </span>
    </div>
  );
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={`${BOX} flex flex-col justify-between`}>
      <span className={LABEL}>{label}</span>
      {children}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 rounded border border-ok/20 bg-ok/10 px-2 py-0.5 font-mono text-[11px] font-medium text-ok">
      <span className="size-1.5 rounded-full bg-ok" />
      {children}
    </span>
  );
}
