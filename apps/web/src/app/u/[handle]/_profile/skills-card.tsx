"use client";

import type { PublicProfile } from "@greenbuild/shared";
import { useState } from "react";
import { ExpandMoreIcon } from "../../../../ui/icons-profile";
import { SKILLS_SHOWN, type SkillRow, skillRows } from "./profile-view";
import { CARD, HEADLINE_SM, LABEL_CODE } from "./type";

// Frame 3:4532 › Skills & Glicko-2 Competency. Ratings, intervals and attempts are real; "last solved"
// has no public data yet ("—"). The frame's ±2σ and microVM runs are not how greenbuild works: the
// interval is ± 1.96 × rating deviation, and the runs are attempts in gVisor sandboxes.
export function SkillsCard({ profile }: { profile: PublicProfile }) {
  const [expanded, setExpanded] = useState(false);
  const rows = skillRows(profile, expanded);
  return (
    <section className={`${CARD} gap-5`}>
      <div className="flex items-center justify-between gap-2 border-b border-control pb-2">
        <div>
          <h2 className={`${HEADLINE_SM} text-ink`}>Skills &amp; Glicko-2 Competency</h2>
          <p className="mt-0.5 type-label text-ink-muted">Glicko-2 rating with its 95% interval (± 1.96 × rating deviation)</p>
        </div>
        <span className="rounded border border-accent-soft/20 bg-accent-soft/10 px-2 py-0.5 font-mono type-label text-accent-soft">τ = 0.5 · RATED AFTER EVERY ATTEMPT</span>
      </div>
      <div className="flex flex-col gap-5">
        {rows.length === 0 ? <p className="rounded-lg bg-surface/60 p-3 type-body text-ink-muted">No ratings yet.</p> : rows.map((row) => <SkillLine key={row.key} row={row} />)}
      </div>
      {!expanded && profile.skills.length > SKILLS_SHOWN && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={`flex items-center justify-center gap-1.5 border-t border-control pt-2 ${LABEL_CODE} text-ink-muted hover:text-accent-soft`}
        >
          Show all {profile.skills.length} skills
          <ExpandMoreIcon className="text-[16px]" />
        </button>
      )}
    </section>
  );
}

function SkillLine({ row }: { row: SkillRow }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface/60 p-3 hover:bg-surface">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono type-label text-ink-subtle">{row.position}</span>
          <span className="truncate text-[15px] leading-5.5 font-semibold text-ink">{row.name}</span>
          <span className="rounded bg-control px-1.5 type-label text-accent-soft">{row.key}</span>
        </div>
        <div className="shrink-0 text-right">
          <span className="font-mono text-2xl font-bold tracking-tight text-ink">{row.rating}</span>
          <span className="ml-1 type-label text-ok">{row.spread}</span>
        </div>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-line">
        <div className="absolute top-0 bottom-0 rounded-full bg-accent-soft/25" style={{ left: `${row.band.left}%`, width: `${row.band.width}%` }} />
        <div className="absolute top-0 bottom-0 w-1.5 bg-accent-soft shadow-[0_0_8px_#22d3ee]" style={{ left: `${row.point}%` }} />
      </div>
      <div className="flex items-center justify-between type-label text-ink-muted">
        <span>
          95% CI: {row.interval} · {row.attempts}
        </span>
        <span className="text-ink-subtle">Last solved —</span>
      </div>
    </div>
  );
}
