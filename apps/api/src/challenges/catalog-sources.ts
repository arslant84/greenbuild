import { attempts, challenges, challengeVersions, type Database, desc, eq, sql } from "@greenbuild/db";

// latestVersions is each challenge's newest version: what its card shows and what a start launches. A
// challenge whose newest version was retired (a leak, task 49d) has none until a newer one is published;
// an older version does not come back.
export function latestVersions(db: Database) {
  const newest = db
    .selectDistinctOn([challengeVersions.challengeId], {
      challengeId: challengeVersions.challengeId,
      id: challengeVersions.id,
      version: challengeVersions.version,
      imageRef: challengeVersions.imageRef,
      specJson: challengeVersions.specJson,
      retiredReason: challengeVersions.retiredReason,
    })
    .from(challengeVersions)
    .orderBy(challengeVersions.challengeId, desc(challengeVersions.version))
    .as("newest");
  return db
    .select({ challengeId: newest.challengeId, id: newest.id, version: newest.version, imageRef: newest.imageRef, specJson: newest.specJson })
    .from(newest)
    .where(sql`${newest.retiredReason} is null`)
    .as("latest");
}

export type LatestVersions = ReturnType<typeof latestVersions>;

// playerProgress sums up one player's attempts per challenge, over every version of it.
export function playerProgress(db: Database, userId: string) {
  const isActive = sql`${attempts.status} in ('starting', 'ready')`;
  const isSolved = sql`${attempts.status} = 'solved'`;
  return db
    .select({
      challengeId: challengeVersions.challengeId,
      activeAttemptId: sql<string | null>`(array_agg(${attempts.id}) filter (where ${isActive}))[1]`.as("active_attempt_id"),
      lastFinishedAttemptId: sql<string | null>`(array_agg(${attempts.id} order by ${attempts.createdAt} desc) filter (where not ${isActive}))[1]`.as("last_finished_attempt_id"),
      solved: sql<boolean>`bool_or(${isSolved})`.as("solved"),
      finishedAttempts: sql<number>`(count(*) filter (where not ${isActive}))::int`.as("finished_attempts"),
      bestSolveMs: sql<number | null>`min(${attempts.durationMs}) filter (where ${isSolved})`.as("best_solve_ms"),
      flagged: sql<boolean>`bool_or(${attempts.flagged})`.as("flagged"),
    })
    .from(attempts)
    .innerJoin(challengeVersions, eq(challengeVersions.id, attempts.challengeVersionId))
    .where(eq(attempts.userId, userId))
    .groupBy(challengeVersions.challengeId)
    .as("progress");
}

export type PlayerProgress = ReturnType<typeof playerProgress>;

// progressStatus is the card's status: in progress wins over solved, solved over failed.
export function progressStatus(progress: PlayerProgress) {
  return sql<"solved" | "failed" | "in_progress" | null>`case
    when ${progress.activeAttemptId} is not null then 'in_progress'
    when ${progress.solved} then 'solved'
    when ${progress.finishedAttempts} > 0 then 'failed'
  end`;
}

// The catalog only ever shows live public challenges.
export const isListed = sql`${challenges.status} = 'live' and ${challenges.visibility} = 'public'`;
