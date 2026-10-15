import type { PublicProfile } from "@greenbuild/shared";
import { ExpandMoreIcon } from "../../../../ui/icons-profile";
import { formatNumber } from "./profile-view";
import { CARD, HEADLINE_SM } from "./type";

const AXIS = ["90 days ago", "60 days ago", "30 days ago", "Current"];
const GRID_LINES = [20, 50, 80];

// Frame 3:4532 › Verified Milestones & Badges. Badges do not exist yet; the frame's "cryptographic
// accomplishments" are not true for greenbuild.
export function BadgesCard() {
  return (
    <section className={`${CARD} gap-3`}>
      <div className="border-b border-control pb-2">
        <h2 className={`${HEADLINE_SM} text-ink`}>Verified Milestones &amp; Badges</h2>
        <p className="type-label text-ink-muted">Milestones earned in sandboxes</p>
      </div>
      <p className="rounded-lg border border-control bg-surface p-3 type-body text-ink-muted">No badges yet.</p>
    </section>
  );
}

// Frame 3:4532 › Rating Stability & Solve Velocity Breakdown, open as in the frame. The rating history and
// solve times are not in the public profile yet ("—", an empty chart); τ is greenbuild's Glicko-2 system
// constant, and checked solves replace the frame's microVM replays and Merkle root.
export function StabilityCard({ profile }: { profile: PublicProfile }) {
  return (
    <details open className="group overflow-hidden rounded-xl border border-control bg-canvas">
      <summary className="flex cursor-pointer items-center justify-between p-5 select-none hover:bg-surface/40">
        <div>
          <h3 className="text-[15px] leading-5.5 font-semibold text-ink">Rating Stability &amp; Solve Velocity Breakdown</h3>
          <p className="type-label text-ink-muted">Rating and solve times over the last 90 days</p>
        </div>
        <ExpandMoreIcon className="text-[24px] text-ink-subtle transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-5 border-t border-control/60 p-5 pt-0">
        <div className="flex w-full flex-col gap-2 rounded-lg bg-surface p-4">
          <div className="flex items-center justify-between type-label">
            <span className="text-ink-muted">90-Day Rating Convergence Curve</span>
            <span className="font-bold text-accent-soft">—</span>
          </div>
          <svg className="h-24 w-full text-accent-soft" viewBox="0 0 600 100" fill="none" aria-hidden="true">
            {GRID_LINES.map((y) => (
              <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="currentColor" strokeDasharray="4 4" strokeOpacity="0.08" />
            ))}
          </svg>
          <div className="flex items-center justify-between pt-1 type-label text-ink-subtle">
            {AXIS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Metric label="System Volatility" value="τ = 0.50" note="Glicko-2 system constant" />
          <Metric label="Median Solve Velocity" value="—" note="P90: —" />
          <Metric label="Checked Solves" value={formatNumber(profile.solved)} note="Each passed its check" />
        </div>
      </div>
    </details>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <span className="block type-label text-ink-subtle">{label}</span>
      <span className="font-mono text-lg font-bold text-ink">{value}</span>
      <span className="mt-0.5 block type-label text-ok">{note}</span>
    </div>
  );
}
