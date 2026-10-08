import { and, challenges, type Database, desc, eq, sql } from "@greenbuild/db";
import type { CatalogEntry, ChallengeList, ChallengeListQuery } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient } from "../infra/services.js";
import { catalogFilters } from "./catalog-filters.js";
import { isListed, type LatestVersions, latestVersions, type PlayerProgress, playerProgress, progressStatus } from "./catalog-sources.js";
import { challengeCard } from "./challenge-card.js";

// Catalog lists live public challenges, newest first, with the player's own progress on each. Skills,
// difficulty and the time limit come from each one's latest version, as its card shows them; ids are
// UUID v7, so id order is creation order and the cursor.
@Injectable()
export class Catalog {
  constructor(private readonly database: DatabaseClient) {}

  async page(userId: string, query: ChallengeListQuery): Promise<ChallengeList> {
    const db = this.database.db;
    const latest = latestVersions(db);
    const progress = playerProgress(db, userId);
    const filters = catalogFilters(query, latest, progress);
    const after = query.cursor === undefined ? undefined : sql`${challenges.id} < ${query.cursor}`;
    const [rows, total, everything] = await Promise.all([
      entries(db, latest, progress)
        .where(and(filters, after))
        .orderBy(desc(challenges.id))
        .limit(query.limit + 1),
      countEntries(db, latest, progress).where(filters),
      entries(db, latest, progress).where(isListed),
    ]);
    const shown = rows.slice(0, query.limit);
    return {
      challenges: shown.map(toEntry),
      next_cursor: rows.length > query.limit ? (shown.at(-1)?.challengeId ?? null) : null,
      total: total[0]?.total ?? 0,
      catalog: summarize(everything),
    };
  }
}

function entries(db: Database, latest: LatestVersions, progress: PlayerProgress) {
  return db
    .select({
      challengeId: challenges.id,
      slug: challenges.slug,
      id: latest.id,
      version: latest.version,
      imageRef: latest.imageRef,
      specJson: latest.specJson,
      status: progressStatus(progress),
      solved: progress.solved,
      finishedAttempts: progress.finishedAttempts,
      bestSolveMs: progress.bestSolveMs,
      activeAttemptId: progress.activeAttemptId,
    })
    .from(challenges)
    .innerJoin(latest, eq(latest.challengeId, challenges.id))
    .leftJoin(progress, eq(progress.challengeId, challenges.id));
}

function countEntries(db: Database, latest: LatestVersions, progress: PlayerProgress) {
  return db
    .select({ total: sql<number>`count(*)::int` })
    .from(challenges)
    .innerJoin(latest, eq(latest.challengeId, challenges.id))
    .leftJoin(progress, eq(progress.challengeId, challenges.id));
}

type EntryRow = Awaited<ReturnType<typeof entries>>[number];

function toEntry(row: EntryRow): CatalogEntry {
  return {
    ...challengeCard(row.slug, row),
    progress: {
      status: row.status,
      finished_attempts: row.finishedAttempts ?? 0,
      best_solve_ms: row.bestSolveMs,
      active_attempt_id: row.activeAttemptId,
    },
  };
}

// summarize counts the whole catalog: challenges, the ones the player solved, and challenges per skill.
function summarize(rows: EntryRow[]): ChallengeList["catalog"] {
  const skills: Record<string, number> = {};
  for (const row of rows) {
    for (const skill of challengeCard(row.slug, row).skills) {
      skills[skill] = (skills[skill] ?? 0) + 1;
    }
  }
  return { challenges: rows.length, solved: rows.filter((row) => row.solved).length, skills };
}
