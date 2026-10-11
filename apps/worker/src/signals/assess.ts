import { and, attempts, attemptSignals, challengeVersions, type Database, eq, userSkills } from "@greenbuild/db";
import { GLICKO_INITIAL_RATING } from "@greenbuild/shared";
import { z } from "zod";
import { medianSolveMs } from "../xp/credit.js";
import { findSignals, isFlagged, type Signal } from "./rules.js";
import type { SessionLogs } from "./logs.js";

const manifestSkillsSchema = z.object({ skills: z.record(z.string(), z.number()).default({}) });

// ratingGap is the version's rating minus the player's skill rating weighted like the manifest; a skill
// the player was never rated in counts at the starting rating.
async function ratingGap(db: Database, userId: string, version: { rating: number; specJson: unknown }): Promise<number | null> {
  const parsed = manifestSkillsSchema.safeParse(version.specJson);
  const weights = parsed.success ? parsed.data.skills : {};
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  if (total === 0) {
    return null;
  }
  const rows = await db.select({ skill: userSkills.skill, rating: userSkills.rating }).from(userSkills).where(eq(userSkills.userId, userId));
  const ratings = new Map(rows.map((row) => [row.skill, row.rating]));
  const player = Object.entries(weights).reduce((sum, [skill, weight]) => sum + weight * (ratings.get(skill) ?? GLICKO_INITIAL_RATING), 0) / total;
  return version.rating - player;
}

// assessAttempt records an attempt's anti-cheat signals and flags it when they add up (architecture.md,
// "Античит — слой 2", task 49b). It runs before the rating, which leaves flagged attempts out until
// reviewed. Attempts already rated or that never reached a sandbox are skipped; signals are unique per
// attempt, so running again adds nothing.
export async function assessAttempt(db: Database, logs: SessionLogs | null, attemptId: string): Promise<void> {
  const [row] = await db
    .select({ attempt: attempts, challengeId: challengeVersions.challengeId, version: { rating: challengeVersions.rating, specJson: challengeVersions.specJson } })
    .from(attempts)
    .innerJoin(challengeVersions, eq(challengeVersions.id, attempts.challengeVersionId))
    .where(eq(attempts.id, attemptId));
  const startedAt = row?.attempt.startedAt;
  if (!row || !startedAt || row.attempt.ratedAt) {
    return;
  }
  const { attempt } = row;
  const finishedAt = attempt.finishedAt ?? new Date();
  const solved = attempt.status === "solved";
  const signals = findSignals(logs ? await logs.read(attemptId, startedAt, finishedAt) : null, {
    solved,
    checksUsed: attempt.checksUsed,
    startedAt,
    finishedAt,
    durationMs: attempt.durationMs,
    medianSolveMs: solved ? await medianSolveMs(db, row.challengeId, attemptId) : null,
    ratingGap: solved ? await ratingGap(db, attempt.userId, row.version) : null,
  });
  await recordSignals(db, attemptId, signals);
}

// recordSignals keeps the signals and flags the attempt when they add up.
async function recordSignals(db: Database, attemptId: string, signals: Signal[]): Promise<void> {
  if (signals.length === 0) {
    return;
  }
  await db.insert(attemptSignals).values(signals.map((found) => ({ attemptId, ...found }))).onConflictDoNothing();
  if (isFlagged(signals)) {
    await db.update(attempts).set({ flagged: true }).where(and(eq(attempts.id, attemptId), eq(attempts.flagged, false)));
  }
}
