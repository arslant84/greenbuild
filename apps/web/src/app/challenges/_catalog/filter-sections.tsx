import { CATALOG_SLA_WINDOWS, type CatalogSlaWindow, type ChallengeList } from "@greenbuild/shared";
import Link from "next/link";
import { type CatalogParams, catalogHref, SEVERITY_TIERS, type SeverityTier, type StatusFilter, toggled } from "./catalog-params";
import { FilterRow, RowText, SectionTitle } from "./filter-rows";
import { skillStyle } from "./skills";

type Summary = ChallengeList["catalog"];

// Figma › Section: Skills.
export function SkillSection({ params, summary }: { params: CatalogParams; summary: Summary | null }) {
  const skills = Object.keys(summary?.skills ?? {}).sort();
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <SectionTitle>Target stack ({skills.length})</SectionTitle>
        <span className="type-label font-medium text-accent-soft">{params.skill.length} Active</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {skills.map((skill) => {
          const style = skillStyle(skill);
          const label = (
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: style.dot }} />
              <RowText>{style.label}</RowText>
            </span>
          );
          return <FilterRow key={skill} href={catalogHref(toggled(params, "skill", skill))} checked={params.skill.includes(skill)} label={label} count={summary?.skills[skill] ?? 0} />;
        })}
      </div>
    </section>
  );
}

// Figma › Section: Difficulty Scale. The meter is the frame's fixed T1–T10 scale.
export function SeveritySection({ params }: { params: CatalogParams }) {
  const tiers: (SeverityTier | null)[] = [null, ...(Object.keys(SEVERITY_TIERS) as SeverityTier[])];
  return (
    <section className="flex flex-col gap-2 rounded-lg bg-canvas/40 p-2">
      <div className="flex items-center justify-between">
        <SectionTitle>Severity (1–10)</SectionTitle>
        <span className="type-label font-medium text-warn">{params.tier ? `Tier ${params.tier}` : "All tiers"}</span>
      </div>
      <div className="flex gap-1 rounded-lg bg-surface-raised p-1">
        {tiers.map((tier) => (
          <Link
            key={tier ?? "all"}
            href={catalogHref({ ...params, tier })}
            scroll={false}
            aria-pressed={params.tier === tier}
            className={`type-label flex-1 rounded py-1 text-center ${params.tier === tier ? "bg-control font-semibold text-ink" : "text-ink-subtle"}`}
          >
            {tier ?? "All"}
          </Link>
        ))}
      </div>
      <div className="flex flex-col gap-1 px-1 pt-2">
        <div className="type-label flex justify-between text-ink-subtle">
          <span>T1</span>
          <span>T5</span>
          <span>T10</span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-control">
          <span className="w-[54px] bg-ok" />
          <span className="w-[72px] bg-warn" />
          <span className="w-[54px] bg-danger" />
        </div>
      </div>
    </section>
  );
}

const STATUS_ROWS: {
  status: StatusFilter | null;
  label: string;
  color: string;
  count: (summary: Summary) => number;
}[] = [
  {
    status: null,
    label: "All Incidents",
    color: "text-ink",
    count: (summary) => summary.challenges,
  },
  {
    status: "unsolved",
    label: "Unsolved",
    color: "text-ink",
    count: (summary) => summary.challenges - summary.solved,
  },
  {
    status: "solved",
    label: "Solved",
    color: "text-ok",
    count: (summary) => summary.solved,
  },
  {
    status: "failed",
    label: "Failed",
    color: "text-danger",
    count: (summary) => summary.failed,
  },
  {
    status: "flagged",
    label: "Flagged",
    color: "text-warn",
    count: (summary) => summary.flagged,
  },
];

// Figma › Section: Status.
export function StatusSection({ params, summary }: { params: CatalogParams; summary: Summary | null }) {
  return (
    <section className="flex flex-col gap-2.5 pt-1">
      <SectionTitle>Attempt status</SectionTitle>
      <div className="flex flex-col gap-1.5">
        {STATUS_ROWS.map((row) => {
          const countClass = row.status === "solved" || row.status === "failed" ? row.color : "text-ink-subtle";
          const label = <RowText className={row.color}>{row.label}</RowText>;
          return (
            <FilterRow
              key={row.label}
              href={catalogHref({ ...params, status: row.status })}
              checked={params.status === row.status}
              label={label}
              count={summary ? row.count(summary) : null}
              round
              countClass={countClass}
            />
          );
        })}
      </div>
    </section>
  );
}

const SLA_LABELS: Record<CatalogSlaWindow, string> = {
  lt5: "< 5 mins",
  "5to10": "5–10 mins",
  "10to15": "10–15 mins",
  "15plus": "15+ mins",
};

// Figma › Section: Time Limit.
export function SlaSection({ params, summary }: { params: CatalogParams; summary: Summary | null }) {
  return (
    <section className="flex flex-col gap-2.5 pt-1">
      <SectionTitle>SLA window</SectionTitle>
      <div className="flex flex-col gap-1">
        {(Object.keys(CATALOG_SLA_WINDOWS) as CatalogSlaWindow[]).map((window) => (
          <FilterRow
            key={window}
            href={catalogHref(toggled(params, "sla", window))}
            checked={params.sla.includes(window)}
            label={<RowText>{SLA_LABELS[window]}</RowText>}
            count={summary?.sla[window] ?? null}
            tight
          />
        ))}
      </div>
    </section>
  );
}

// Figma › Section: Challenge Source. Sources have no data yet, so the choices are shown but inactive.
export function SourceSection() {
  return (
    <section className="flex flex-col gap-2.5 pt-1">
      <SectionTitle>Source origin</SectionTitle>
      <div className="flex flex-col gap-1">
        <FilterRow href={null} checked={false} label={<RowText>Official Core</RowText>} count={null} tight />
        <FilterRow href={null} checked={false} label={<RowText>Community</RowText>} count={null} tight />
        <FilterRow href={null} checked={false} label={<RowText>Enterprise Org</RowText>} count={<span className="type-label rounded bg-control px-1.5 py-0.5 text-ink-subtle">TEAM</span>} tight />
      </div>
    </section>
  );
}
