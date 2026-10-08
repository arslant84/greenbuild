import { CATALOG_SLA_WINDOWS, CATALOG_STATUS_FILTERS, type CatalogSlaWindow } from "@greenbuild/shared";

// Figma › Section: Difficulty Scale: the tiers a player can pick, as difficulty ranges.
export const SEVERITY_TIERS = {
  "1-3": [1, 3],
  "4-6": [4, 6],
  "7-10": [7, 10],
} as const;
export type SeverityTier = keyof typeof SEVERITY_TIERS;
export type StatusFilter = (typeof CATALOG_STATUS_FILTERS)[number];

// The catalog's filters live in the page URL, so every filtered view can be linked and reloaded.
export interface CatalogParams {
  skill: string[];
  sla: CatalogSlaWindow[];
  status: StatusFilter | null;
  tier: SeverityTier | null;
  q: string | null;
}

type SearchParams = Record<string, string | string[] | undefined>;

const SKILL = /^[a-z0-9]+(_[a-z0-9]+)*$/;
const SEARCH_MAX = 100;
const listOf = (value: string | string[] | undefined): string[] => (value === undefined ? [] : [value].flat());
const isIn = <Key extends string>(keys: readonly Key[], value: string | undefined): value is Key => keys.includes(value as Key);

// readCatalogParams keeps the values the API accepts and drops the rest, so a stale link still opens.
export function readCatalogParams(search: SearchParams): CatalogParams {
  const status = listOf(search.status)[0];
  const tier = listOf(search.tier)[0];
  const q = listOf(search.q)[0]?.trim().slice(0, SEARCH_MAX);
  return {
    skill: [...new Set(listOf(search.skill).filter((skill) => SKILL.test(skill)))],
    sla: [...new Set(listOf(search.sla).filter((window) => isIn(Object.keys(CATALOG_SLA_WINDOWS) as CatalogSlaWindow[], window)))] as CatalogSlaWindow[],
    status: isIn(CATALOG_STATUS_FILTERS, status) ? status : null,
    tier: isIn(Object.keys(SEVERITY_TIERS) as SeverityTier[], tier) ? tier : null,
    q: q ? q : null,
  };
}

function toSearch(params: CatalogParams): URLSearchParams {
  const search = new URLSearchParams();
  params.skill.forEach((skill) => search.append("skill", skill));
  params.sla.forEach((window) => search.append("sla", window));
  if (params.status) search.set("status", params.status);
  if (params.tier) search.set("tier", params.tier);
  if (params.q) search.set("q", params.q);
  return search;
}

// catalogHref is the page URL for a set of filters.
export function catalogHref(params: CatalogParams): string {
  const search = toSearch(params).toString();
  return search ? `/challenges?${search}` : "/challenges";
}

// apiQuery is the GET /v1/challenges query for a set of filters; tiers become difficulty ranges.
export function apiQuery(params: CatalogParams, cursor?: string): string {
  const search = toSearch({ ...params, tier: null });
  if (params.tier) {
    const [min, max] = SEVERITY_TIERS[params.tier];
    search.set("difficulty_min", String(min));
    search.set("difficulty_max", String(max));
  }
  if (cursor) search.set("cursor", cursor);
  const query = search.toString();
  return query ? `?${query}` : "";
}

// toggled adds a value to a multi-value filter, or removes it when it is already there.
export function toggled<Key extends "skill" | "sla">(params: CatalogParams, key: Key, value: CatalogParams[Key][number]): CatalogParams {
  const values = params[key] as string[];
  const next = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  return { ...params, [key]: next };
}

export const NO_FILTERS: CatalogParams = {
  skill: [],
  sla: [],
  status: null,
  tier: null,
  q: null,
};

export function activeFilterCount(params: CatalogParams): number {
  return params.skill.length + params.sla.length + (params.status ? 1 : 0) + (params.tier ? 1 : 0) + (params.q ? 1 : 0);
}
