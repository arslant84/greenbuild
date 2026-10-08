import { and, or, type SQL, sql } from "@greenbuild/db";
import { CATALOG_SLA_WINDOWS, type ChallengeListQuery } from "@greenbuild/shared";
import { isListed, type LatestVersions, type PlayerProgress, progressStatus } from "./catalog-sources.js";

type Filters = Omit<ChallengeListQuery, "limit" | "cursor">;

// catalogFilters is the WHERE clause for the filters a player picked, on top of what is listed at all.
export function catalogFilters(filters: Filters, latest: LatestVersions, progress: PlayerProgress): SQL | undefined {
  const spec = latest.specJson;
  return and(
    isListed,
    filters.skill && sql`${spec} -> 'skills' ?| array[${sql.join(filters.skill.map((skill) => sql`${skill}`), sql`, `)}]`,
    filters.sla && or(...filters.sla.map((window) => timeLimitWithin(spec, CATALOG_SLA_WINDOWS[window]))),
    filters.q === undefined ? undefined : matchesText(spec, filters.q),
    sql`(${spec} ->> 'difficulty')::int between ${filters.difficulty_min ?? 1} and ${filters.difficulty_max ?? 10}`,
    filters.status && statusFilter(filters.status, progress),
  );
}

function timeLimitWithin(spec: LatestVersions["specJson"], [from, to]: readonly [number, number]): SQL {
  return sql`(${spec} ->> 'time_limit_sec')::int between ${from} and ${to}`;
}

// The search is a plain substring of the title or the statement; % and _ in it are literal.
function matchesText(spec: LatestVersions["specJson"], text: string): SQL {
  const pattern = `%${text.replace(/[\\%_]/g, "\\$&")}%`;
  return sql`(${spec} ->> 'title' ilike ${pattern} or ${spec} ->> 'statement' ilike ${pattern})`;
}

function statusFilter(status: NonNullable<Filters["status"]>, progress: PlayerProgress): SQL {
  switch (status) {
    case "unsolved":
      return sql`coalesce(${progress.solved}, false) = false`;
    case "solved":
      return sql`coalesce(${progress.solved}, false)`;
    case "failed":
      return sql`${progressStatus(progress)} = 'failed'`;
    case "flagged":
      return sql`coalesce(${progress.flagged}, false)`;
  }
}
