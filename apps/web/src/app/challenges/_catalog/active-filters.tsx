import Link from "next/link";
import { CloseSmallIcon } from "../../../ui/icons-catalog";
import { activeFilterCount, type CatalogParams, catalogHref, toggled } from "./catalog-params";
import { skillStyle } from "../../../ui/skills";

interface Chip {
  key: string;
  label: string;
  dot: string | null;
  without: CatalogParams;
}

function chipsFor(params: CatalogParams): Chip[] {
  const skills = params.skill.map((skill) => ({ key: `skill-${skill}`, label: `Skill: ${skillStyle(skill).label}`, dot: skillStyle(skill).dot, without: toggled(params, "skill", skill) }));
  const windows = params.sla.map((window) => ({ key: `sla-${window}`, label: `SLA: ${window}`, dot: null, without: toggled(params, "sla", window) }));
  const single: [keyof CatalogParams, string, string | null][] = [
    ["tier", "Severity", params.tier],
    ["status", "Status", params.status],
    ["q", "Search", params.q],
  ];
  const singles = single.flatMap(([key, name, value]) => (value ? [{ key, label: `${name}: ${value}`, dot: null, without: { ...params, [key]: null } }] : []));
  return [...skills, ...windows, ...singles];
}

// Figma › Active Filter Pill Tags Row.
export function ActiveFilters({ params }: { params: CatalogParams }) {
  return (
    <div className="flex min-h-5 flex-wrap items-center gap-1">
      {chipsFor(params).map((chip) => (
        <span key={chip.key} className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1">
          {chip.dot && <span className="size-1.5 rounded-full" style={{ background: chip.dot }} />}
          <span className="type-label text-ink">{chip.label}</span>
          <Link href={catalogHref(chip.without)} scroll={false} aria-label={`Remove ${chip.label}`} className="pl-1 text-ink">
            <CloseSmallIcon />
          </Link>
        </span>
      ))}
      <span className="type-label rounded-lg bg-surface px-3 py-1 text-ink-subtle">Sort: Recently added</span>
      {activeFilterCount(params) > 0 && (
        <Link href="/challenges" scroll={false} className="type-label ml-auto text-accent-soft">
          Clear all filters
        </Link>
      )}
    </div>
  );
}
