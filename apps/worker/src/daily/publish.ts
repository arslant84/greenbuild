import { randomInt } from "node:crypto";
import { and, challenges, challengeVersions, dailyChallenges, type Database, desc, eq, sql } from "@greenbuild/db";
import { DAILY_REPEAT_WINDOW_DAYS, type DAILY_TRACKS } from "@greenbuild/shared";

export type DailyTrack = (typeof DAILY_TRACKS)[number];
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const DAY_MS = 86_400_000;

interface Candidate {
  challengeId: string;
  versionId: string;
}

// publishDaily makes sure day (YYYY-MM-DD, UTC) has a daily challenge for track and returns its
// version id. Publishing again returns the same one; the unique (day, track) pair also settles two
// workers publishing at once.
export async function publishDaily(db: Database, day: string, track: DailyTrack): Promise<string> {
  return db.transaction(async (tx) => {
    const existing = await publishedVersion(tx, day, track);
    if (existing) {
      return existing;
    }
    const candidates = await liveCandidates(tx);
    if (candidates.length === 0) {
      throw new Error(`daily ${track} ${day}: no live public challenge to publish`);
    }
    const chosen = choose(candidates, await lastPublished(tx, day, track), day);
    await tx.insert(dailyChallenges).values({ day, track, challengeVersionId: chosen }).onConflictDoNothing();
    return (await publishedVersion(tx, day, track)) ?? chosen;
  });
}

async function publishedVersion(tx: Transaction, day: string, track: DailyTrack): Promise<string | undefined> {
  const [row] = await tx
    .select({ versionId: dailyChallenges.challengeVersionId })
    .from(dailyChallenges)
    .where(and(eq(dailyChallenges.day, day), eq(dailyChallenges.track, track)));
  return row?.versionId;
}

// liveCandidates lists the newest version of every live public challenge, as players get it.
async function liveCandidates(tx: Transaction): Promise<Candidate[]> {
  return tx
    .selectDistinctOn([challengeVersions.challengeId], { challengeId: challengeVersions.challengeId, versionId: challengeVersions.id })
    .from(challengeVersions)
    .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
    .where(and(eq(challenges.status, "live"), eq(challenges.visibility, "public")))
    .orderBy(challengeVersions.challengeId, desc(challengeVersions.version));
}

// lastPublished maps each challenge to the last day before day it was this track's daily challenge.
async function lastPublished(tx: Transaction, day: string, track: DailyTrack): Promise<Map<string, string>> {
  const rows = await tx
    .select({ challengeId: challengeVersions.challengeId, lastDay: sql<string>`max(${dailyChallenges.day})::text` })
    .from(dailyChallenges)
    .innerJoin(challengeVersions, eq(challengeVersions.id, dailyChallenges.challengeVersionId))
    .where(and(eq(dailyChallenges.track, track), sql`${dailyChallenges.day} < ${day}`))
    .groupBy(challengeVersions.challengeId);
  return new Map(rows.map((row) => [row.challengeId, row.lastDay]));
}

// choose picks at random among challenges not published in the last DAILY_REPEAT_WINDOW_DAYS. When
// every one was (fewer challenges than days in the window), it picks among those published longest ago.
function choose(candidates: Candidate[], lastDays: Map<string, string>, day: string): string {
  const daysSince = (candidate: Candidate): number => {
    const last = lastDays.get(candidate.challengeId);
    return last === undefined ? Number.POSITIVE_INFINITY : (Date.parse(day) - Date.parse(last)) / DAY_MS;
  };
  const rested = candidates.filter((candidate) => daysSince(candidate) >= DAILY_REPEAT_WINDOW_DAYS);
  const longest = Math.max(...candidates.map(daysSince));
  const pool = rested.length > 0 ? rested : candidates.filter((candidate) => daysSince(candidate) === longest);
  return pool[randomInt(pool.length)]?.versionId ?? candidates[0]?.versionId ?? "";
}
