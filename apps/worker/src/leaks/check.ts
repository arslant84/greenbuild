import { setTimeout as sleep } from "node:timers/promises";
import { and, attempts, challengeVersions, type Database, eq, inArray, sql } from "@greenbuild/db";
import { FINISHED_ATTEMPT_STATUSES } from "@greenbuild/shared";
import { logger } from "../logger.js";

// architecture.md, "Утечки и ротация" (task 49d): a leaked challenge gets solved more often and faster.
// The thresholds are decided here and recorded in docs/progress.md.
const BASELINE_ATTEMPTS = 30;
const RECENT_DAYS = 7;
const RECENT_MIN_ATTEMPTS = 20;
const SOLVE_RATE_JUMP = 0.25;
const MEDIAN_SHARE = 0.5;
const DAY_MS = 86_400_000;
const CHECK_INTERVAL_MS = 7 * DAY_MS;
export const LEAK_SUSPECTED = "leak_suspected";

export interface Stats {
  attempts: number;
  solveRate: number;
  medianSolveMs: number | null;
}

// isLeakSuspected: enough recent attempts, a solve rate 25 points or more above the baseline and a
// median solve time at most half of it.
export function isLeakSuspected(baseline: { solveRate: number; medianSolveMs: number }, recent: Stats): boolean {
  return (
    recent.attempts >= RECENT_MIN_ATTEMPTS &&
    recent.solveRate >= baseline.solveRate + SOLVE_RATE_JUMP &&
    recent.medianSolveMs !== null &&
    recent.medianSolveMs <= MEDIAN_SHARE * baseline.medianSolveMs
  );
}

// Finished attempts that reached a sandbox; failed starts say nothing about a leak.
function played(versionId: string) {
  return and(eq(attempts.challengeVersionId, versionId), sql`${attempts.startedAt} is not null`, inArray(attempts.status, [...FINISHED_ATTEMPT_STATUSES]));
}

async function stats(db: Database, rows: ReturnType<typeof firstAttempts>): Promise<Stats> {
  const [row] = await db
    .select({
      attempts: sql<number>`count(*)::int`,
      solveRate: sql<number>`coalesce(avg(case when ${rows.status} = 'solved' then 1.0 else 0.0 end), 0)::float`,
      medianSolveMs: sql<number | null>`percentile_cont(0.5) within group (order by ${rows.durationMs}) filter (where ${rows.status} = 'solved')`,
    })
    .from(rows);
  return { attempts: row?.attempts ?? 0, solveRate: Number(row?.solveRate ?? 0), medianSolveMs: row?.medianSolveMs === null || row?.medianSolveMs === undefined ? null : Number(row.medianSolveMs) };
}

// firstAttempts are a version's first BASELINE_ATTEMPTS played attempts.
function firstAttempts(db: Database, versionId: string) {
  return db
    .select({ status: attempts.status, durationMs: attempts.durationMs })
    .from(attempts)
    .where(played(versionId))
    .orderBy(attempts.finishedAt)
    .limit(BASELINE_ATTEMPTS)
    .as("played");
}

// recentAttempts are a version's played attempts that finished since a moment.
function recentAttempts(db: Database, versionId: string, since: Date): ReturnType<typeof firstAttempts> {
  return db
    .select({ status: attempts.status, durationMs: attempts.durationMs })
    .from(attempts)
    .where(and(played(versionId), sql`${attempts.finishedAt} >= ${since.toISOString()}`))
    .as("played");
}

// setBaselines records, once, the solve rate and median of each version's first 30 played attempts.
async function setBaselines(db: Database): Promise<void> {
  const open = await db.select({ id: challengeVersions.id }).from(challengeVersions).where(sql`${challengeVersions.solveRateBaseline} is null`);
  for (const { id } of open) {
    const first = await stats(db, firstAttempts(db, id));
    if (first.attempts >= BASELINE_ATTEMPTS && first.medianSolveMs !== null) {
      await db.update(challengeVersions).set({ solveRateBaseline: first.solveRate, medianSolveMsBaseline: Math.round(first.medianSolveMs) }).where(eq(challengeVersions.id, id));
    }
  }
}

// checkLeaks sets missing baselines, then retires every version whose last 7 days look leaked, and
// returns their ids. A retired version stops being served until a newer one is published.
export async function checkLeaks(db: Database, now: Date): Promise<string[]> {
  await setBaselines(db);
  const versions = await db
    .select({ id: challengeVersions.id, solveRate: challengeVersions.solveRateBaseline, medianSolveMs: challengeVersions.medianSolveMsBaseline })
    .from(challengeVersions)
    .where(sql`${challengeVersions.retiredReason} is null and ${challengeVersions.solveRateBaseline} is not null and ${challengeVersions.medianSolveMsBaseline} is not null`);
  const retired: string[] = [];
  for (const version of versions) {
    const recent = await stats(db, recentAttempts(db, version.id, new Date(now.getTime() - RECENT_DAYS * DAY_MS)));
    if (isLeakSuspected({ solveRate: version.solveRate ?? 0, medianSolveMs: version.medianSolveMs ?? 0 }, recent)) {
      await db.update(challengeVersions).set({ retiredReason: LEAK_SUSPECTED }).where(eq(challengeVersions.id, version.id));
      logger.warn("challenge version retired as leaked", { versionId: version.id, recent });
      retired.push(version.id);
    }
  }
  return retired;
}

// runLeakCheck checks once at start and then weekly until signal aborts; failures are logged and the
// next run tries again.
export async function runLeakCheck(db: Database, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    try {
      await checkLeaks(db, new Date());
    } catch (error) {
      logger.error("leak check failed", { error });
    }
    await sleep(CHECK_INTERVAL_MS, undefined, { signal }).catch(() => undefined);
  }
}
