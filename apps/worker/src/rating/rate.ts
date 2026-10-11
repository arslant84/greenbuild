import { and, attempts, challengeVersions, type Database, eq, inArray, sql, userSkills } from "@greenbuild/db";
import { type AttemptFinished, type Glicko2Rating, updateRating } from "@greenbuild/shared";
import { z } from "zod";
import type { FinishedHandler } from "../finished-consumer.js";
import { syncSkillBoards } from "../leaderboards/boards.js";
import { assessAttempt } from "../signals/assess.js";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type UserSkillRow = typeof userSkills.$inferSelect;

const manifestSkillsSchema = z.object({ skills: z.record(z.string(), z.number()).default({}) });

// rateAttempt applies one finished attempt to the ratings (architecture.md, "Рейтинг навыка", task 43b):
// a game between the player and the challenge version, won if solved. Each of the player's skills moves
// by its weight in the manifest; the version is rated against the player's weighted skill rating.
// Attempts that never reached a sandbox, flagged attempts and attempts already rated are skipped.
export async function rateAttempt(db: Database, event: AttemptFinished): Promise<void> {
  await db.transaction(async (tx) => {
    const [attempt] = await tx
      .select({ userId: attempts.userId, versionId: attempts.challengeVersionId, status: attempts.status, startedAt: attempts.startedAt, flagged: attempts.flagged, ratedAt: attempts.ratedAt })
      .from(attempts)
      .where(eq(attempts.id, event.attempt_id))
      .for("update");
    if (!attempt || attempt.ratedAt || attempt.flagged || !attempt.startedAt) {
      return;
    }
    const [version] = await tx.select().from(challengeVersions).where(eq(challengeVersions.id, attempt.versionId)).for("update");
    if (!version) {
      throw new Error(`rate attempt ${event.attempt_id}: version ${attempt.versionId} not found`);
    }
    const weights = skillWeights(version.specJson);
    const skills = await lockedSkills(tx, attempt.userId, Object.keys(weights));
    if (skills.length > 0) {
      await rateGame(tx, { version, skills, weights, solved: attempt.status === "solved" });
    }
    await tx.update(attempts).set({ ratedAt: new Date() }).where(eq(attempts.id, event.attempt_id));
  });
}

interface Game {
  version: typeof challengeVersions.$inferSelect;
  skills: UserSkillRow[];
  weights: Record<string, number>;
  solved: boolean;
}

// rateGame moves the player's skills and the version's rating by one game.
async function rateGame(tx: Transaction, { version, skills, weights, solved }: Game): Promise<void> {
  const score = solved ? 1 : 0;
  const challenge = { rating: version.rating, deviation: version.ratingDeviation };
  for (const skill of skills) {
    const moved = weighted(toRating(skill), updateRating(toRating(skill), [{ opponent: challenge, score }]), weights[skill.skill] ?? 0);
    await tx
      .update(userSkills)
      .set({ rating: moved.rating, ratingDeviation: moved.deviation, volatility: moved.volatility, attemptsCount: sql`${userSkills.attemptsCount} + 1` })
      .where(eq(userSkills.id, skill.id));
  }
  const rated = updateRating({ ...challenge, volatility: version.ratingVolatility }, [{ opponent: playerAgainst(skills, weights), score: 1 - score }]);
  await tx.update(challengeVersions).set({ rating: rated.rating, ratingDeviation: rated.deviation, ratingVolatility: rated.volatility }).where(eq(challengeVersions.id, version.id));
}

// lockedSkills creates the player's missing skill rows at the starting rating and locks all of them,
// so two attempts finishing together update a skill one after the other.
async function lockedSkills(tx: Transaction, userId: string, skills: string[]): Promise<UserSkillRow[]> {
  if (skills.length === 0) {
    return [];
  }
  await tx
    .insert(userSkills)
    .values(skills.map((skill) => ({ userId, skill })))
    .onConflictDoNothing();
  return tx
    .select()
    .from(userSkills)
    .where(and(eq(userSkills.userId, userId), inArray(userSkills.skill, skills)))
    .for("update");
}

function skillWeights(specJson: unknown): Record<string, number> {
  const parsed = manifestSkillsSchema.safeParse(specJson);
  return parsed.success ? parsed.data.skills : {};
}

function toRating(skill: UserSkillRow): Glicko2Rating {
  return { rating: skill.rating, deviation: skill.ratingDeviation, volatility: skill.volatility };
}

// weighted moves a rating by weight × the full Glicko-2 change, so a skill the challenge barely tests
// barely moves.
function weighted(before: Glicko2Rating, after: Glicko2Rating, weight: number): Glicko2Rating {
  const step = (from: number, to: number): number => from + weight * (to - from);
  return { rating: step(before.rating, after.rating), deviation: step(before.deviation, after.deviation), volatility: step(before.volatility, after.volatility) };
}

// playerAgainst is the player as the version's opponent: their skill ratings weighted like the manifest.
function playerAgainst(skills: UserSkillRow[], weights: Record<string, number>): { rating: number; deviation: number } {
  const total = skills.reduce((sum, skill) => sum + (weights[skill.skill] ?? 0), 0) || 1;
  const mean = (pick: (skill: UserSkillRow) => number): number => skills.reduce((sum, skill) => sum + (weights[skill.skill] ?? 0) * pick(skill), 0) / total;
  return { rating: mean((skill) => skill.rating), deviation: mean((skill) => skill.ratingDeviation) };
}

// The anti-cheat signals come first, so a flagged attempt stays out of the rating (task 49b); the skill
// boards follow user_skills, so they are set after the ratings are committed (task 45a).
export const ratingHandler: FinishedHandler = {
  group: "worker-rating",
  name: "rate attempt",
  handle: async (deps, event) => {
    await assessAttempt(deps.db, deps.logs, event.attempt_id);
    await rateAttempt(deps.db, event);
    await syncSkillBoards(deps, event.user_id);
  },
};
