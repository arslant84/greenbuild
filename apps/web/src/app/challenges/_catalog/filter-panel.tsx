import type { ChallengeList } from "@greenbuild/shared";
import Link from "next/link";
import { FilterListIcon } from "../../../ui/icons-catalog";
import type { CatalogParams } from "./catalog-params";
import { SeveritySection, SkillSection, SlaSection, SourceSection, StatusSection } from "./filter-sections";
import { skillStyle } from "./skills";

interface FilterPanelProps {
  params: CatalogParams;
  summary: ChallengeList["catalog"] | null;
  total: number | null;
}

// Figma › Aside - Left Filter Panel.
export function FilterPanel({ params, summary, total }: FilterPanelProps) {
  return (
    <aside className="flex w-[280px] shrink-0 flex-col gap-5 self-start rounded-xl bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-accent-soft">
          <FilterListIcon />
          <h2 className="text-lg leading-6 font-semibold tracking-[-0.18px] text-ink">Filters</h2>
        </span>
        <Link href="/challenges" className="type-label text-ink-subtle" scroll={false}>
          Reset
        </Link>
      </div>
      <SkillSection params={params} summary={summary} />
      <SeveritySection params={params} />
      <StatusSection params={params} summary={summary} />
      <SlaSection params={params} summary={summary} />
      <SourceSection />
      <PanelFooter params={params} total={total} />
    </aside>
  );
}

// Figma › Filter Panel Footer.
function PanelFooter({ params, total }: { params: CatalogParams; total: number | null }) {
  const skills = params.skill.map((skill) => skillStyle(skill).label);
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-canvas/60 px-3 pt-2 pb-3">
      <div className="type-label flex justify-between">
        <span className="text-ink-muted">Active Matches:</span>
        <span className="font-semibold text-accent-soft">{total ?? "—"} incidents</span>
      </div>
      <span className="type-label text-ink-subtle">{skills.length > 0 ? `Filters: ${skills.join(", ")} (Active)` : "Filters: none"}</span>
    </div>
  );
}
