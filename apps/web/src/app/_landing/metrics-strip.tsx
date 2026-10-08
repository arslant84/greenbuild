import { PassRateIcon, SolveTimeIcon } from "../../ui/icons-landing";

const AVATAR_BACKGROUNDS = ["bg-surface-raised", "bg-control", "bg-line", "bg-surface-raised"];

// Figma (Landing) › Section - SOCIAL PROOF METRICS STRIP. Public solve statistics do not exist yet, so
// the avatars carry no initials and every number is a neutral value.
export function MetricsStrip() {
  return (
    <section className="py-5">
      <div className="flex items-center justify-between rounded-xl bg-surface px-5 py-3">
        <span className="flex items-center gap-3">
          <span className="flex -space-x-2">
            {AVATAR_BACKGROUNDS.map((background, index) => (
              <span key={index} className={`size-8 rounded-full ${background}`} />
            ))}
            <span className="type-label flex size-8 items-center justify-center rounded-full bg-accent font-semibold text-[#00363e]">—</span>
          </span>
          <span className="flex flex-col">
            <span className="text-[13px] leading-[18px] font-semibold text-ink">— engineers solved today</span>
            <span className="type-label text-ink-subtle">Verified check results</span>
          </span>
        </span>
        <span className="type-label flex items-center gap-5 text-ink-muted">
          <span className="flex items-center gap-1.5">
            <SolveTimeIcon className="text-warn" />
            Avg solve time: —
          </span>
          <span className="text-line">|</span>
          <span className="flex items-center gap-1.5">
            <PassRateIcon className="text-ok" />
            Pass rate: —
          </span>
        </span>
      </div>
    </section>
  );
}
