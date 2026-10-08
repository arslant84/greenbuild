import type { CatalogEntry } from "@greenbuild/shared";
import { FailedIcon, InProgressIcon, SolvedIcon } from "../../../ui/icons-catalog";
import { CardButton } from "./card-button";
import { cardAction, slaLabel, solveTime } from "./card-labels";
import { skillStyle } from "./skills";

const DIFFICULTY_STEPS = 10;

// Figma › Article - CARD. Incident and severity numbers have no data yet.
export function CatalogCard({ entry }: { entry: CatalogEntry }) {
  return (
    <article className="flex h-[236px] flex-col justify-between overflow-hidden rounded-xl bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex flex-col gap-2 px-5 pt-5">
        <div className="flex h-[18px] items-center justify-between">
          <span className="type-label text-ink-subtle">INC-— // SEV-—</span>
          <ProgressBadge progress={entry.progress} />
        </div>
        <h3 className="line-clamp-2 text-lg leading-6 font-semibold tracking-[-0.45px] text-ink">{entry.title}</h3>
        <p className="line-clamp-2 text-[13px] leading-[18px] text-ink-muted">{entry.statement}</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {entry.skills.map((skill) => {
            const style = skillStyle(skill);
            return (
              <span key={skill} className="rounded px-2 py-0.5 font-mono text-[11px] leading-[14px] font-medium tracking-[0.44px]" style={{ color: style.text, background: style.background }}>
                {style.label}
              </span>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between bg-canvas/50 p-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] leading-[18px]" aria-label={`Difficulty ${entry.difficulty} of ${DIFFICULTY_STEPS}`}>
            <span className="text-accent-soft">{"●".repeat(entry.difficulty)}</span>
            <span className="text-line">{"○".repeat(DIFFICULTY_STEPS - entry.difficulty)}</span>
          </span>
          <span className="type-label text-ink-subtle">⏱ {slaLabel(entry.time_limit_sec)}</span>
        </div>
        <CardButton action={cardAction(entry)} />
      </div>
    </article>
  );
}

const BADGE = "flex h-[18px] items-center gap-1 rounded px-2 font-mono text-[11px] leading-[14px] font-medium tracking-[0.44px]";

function ProgressBadge({ progress }: { progress: CatalogEntry["progress"] }) {
  switch (progress.status) {
    case "solved":
      return (
        <span className={`${BADGE} bg-[#43db7133] text-ok`}>
          <SolvedIcon />
          {progress.best_solve_ms === null ? "Solved" : `Solved (${solveTime(progress.best_solve_ms)})`}
        </span>
      );
    case "failed":
      return (
        <span className={`${BADGE} bg-[#93000a4d] text-danger`}>
          <FailedIcon />
          Failed ({progress.finished_attempts} att)
        </span>
      );
    case "in_progress":
      return (
        <span className={`${BADGE} bg-[#8aebff33] text-accent-soft`}>
          <InProgressIcon />
          In Progress
        </span>
      );
    default:
      return <span className="type-label text-ink-subtle">Never attempted</span>;
  }
}
