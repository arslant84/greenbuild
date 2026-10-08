import type { ChallengeList } from "@greenbuild/shared";
import { XpBoltIcon } from "../../../ui/icons-catalog";

// Figma › Header & Telemetry Subline. Cluster health and XP boosts have no data yet.
export function CatalogHeader({ catalog }: { catalog: ChallengeList["catalog"] | null }) {
  return (
    <div className="flex items-end justify-between pb-5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.8px] text-ink">Challenges</h1>
          <span className="type-label rounded bg-control px-2 py-0.5 text-accent-soft">CATALOG</span>
        </div>
        <p className="type-label font-medium text-ink">
          {catalog ? (
            <>
              {catalog.challenges} challenges · <span className="text-ok">{catalog.solved} solved</span> · <span className="text-warn">{catalog.challenges - catalog.solved} remaining</span>
            </>
          ) : (
            "— challenges · — solved · — remaining"
          )}
        </p>
      </div>
      <div className="flex items-center gap-1 rounded-lg bg-surface px-3 py-1">
        <span className="flex items-center gap-1.5 pr-3">
          <span className="size-2 rounded-full bg-ink-subtle" />
          <span className="type-label text-ink-muted">SANDBOX CLUSTER: —</span>
        </span>
        <span className="flex items-center gap-1 pl-3 text-accent-soft">
          <XpBoltIcon />
          <span className="type-label font-medium">XP BOOST: —</span>
        </span>
      </div>
    </div>
  );
}
