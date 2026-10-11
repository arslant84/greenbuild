import { and, attempts, challenges, challengeVersions, type Database, eq, sql, xpLedger } from "@greenbuild/db";
import { type AttemptFinished, solveXp, XP_MEDIAN_MIN_SOLVES } from "@greenbuild/shared";
import { z } from "zod";
import type { FinishedHandler } from "../finished-consumer.js";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

// Skills are a manifest's skill names with their weights; only the names matter for XP.
const manifestSkillsSchema = z.object({ skills: z.record(z.string(), z.number()).default({}) });

interface SolvedAttempt {
  userId: string;
  challengeId: string;
  difficulty: number;
  hintsUsed: number;
  daily: boolean;
  durationMs: number | null;
  skills: string[];
}

// creditSolve awards the XP a solved attempt earns (architecture.md, task 42a). Other final statuses
// earn nothing. The ledger's unique (attempt, reason) makes a redelivered event a no-op.
export async function creditSolve(db: Database, event: AttemptFinished): Promise<void> {
  if (event.status !== "solved") {
    return;
  }
  await db.transaction(async (tx) => {
    const attempt = await solvedAttempt(tx, event.attempt_id);
    if (!attempt) {
      throw new Error(`credit XP: attempt ${event.attempt_id} not found or not solved`);
    }
    const xp = solveXp({
      difficulty: attempt.difficulty,
      durationMs: attempt.durationMs,
      medianDurationMs: await medianSolveMs(tx, attempt.challengeId, event.attempt_id),
      hintsUsed: attempt.hintsUsed,
      daily: attempt.daily,
      newSkills: await newSkillCount(tx, attempt, event.attempt_id),
    });
    const rows: { reason: "solve" | "new_skills"; amount: number }[] = [{ reason: "solve", amount: xp.solve }];
    if (xp.newSkills > 0) {
      rows.push({ reason: "new_skills", amount: xp.newSkills });
    }
    await tx
      .insert(xpLedger)
      .values(rows.map((row) => ({ ...row, userId: attempt.userId, attemptId: event.attempt_id })))
      .onConflictDoNothing();
  });
}

async function solvedAttempt(tx: Transaction, attemptId: string): Promise<SolvedAttempt | undefined> {
  const [row] = await tx
    .select({
      userId: attempts.userId,
      challengeId: challenges.id,
      difficulty: challenges.difficulty,
      hintsUsed: attempts.hintsUsed,
      context: attempts.context,
      durationMs: attempts.durationMs,
      specJson: challengeVersions.specJson,
    })
    .from(attempts)
    .innerJoin(challengeVersions, eq(challengeVersions.id, attempts.challengeVersionId))
    .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
    .where(and(eq(attempts.id, attemptId), eq(attempts.status, "solved")));
  if (!row) {
    return undefined;
  }
  const { context, specJson, ...attempt } = row;
  return { ...attempt, daily: context === "daily", skills: skillNames(specJson) };
}

// medianSolveMs is the median solve time of other attempts at the challenge (any version), or null
// with fewer than XP_MEDIAN_MIN_SOLVES of them.
async function medianSolveMs(tx: Transaction, challengeId: string, attemptId: string): Promise<number | null> {
  const [row] = await tx
    .select({ solves: sql<number>`count(*)::int`, median: sql<number | null>`percentile_cont(0.5) within group (order by ${attempts.durationMs})` })
    .from(attempts)
    .innerJoin(challengeVersions, eq(challengeVersions.id, attempts.challengeVersionId))
    .where(and(eq(challengeVersions.challengeId, challengeId), eq(attempts.status, "solved"), sql`${attempts.durationMs} is not null`, sql`${attempts.id} <> ${attemptId}`));
  return row && row.solves >= XP_MEDIAN_MIN_SOLVES && row.median !== null ? Number(row.median) : null;
}

// newSkillCount counts the attempt's skills the player has not solved in any other attempt.
async function newSkillCount(tx: Transaction, attempt: SolvedAttempt, attemptId: string): Promise<number> {
  const earlier = await tx
    .select({ specJson: challengeVersions.specJson })
    .from(attempts)
    .innerJoin(challengeVersions, eq(challengeVersions.id, attempts.challengeVersionId))
    .where(and(eq(attempts.userId, attempt.userId), eq(attempts.status, "solved"), sql`${attempts.id} <> ${attemptId}`));
  const solved = new Set(earlier.flatMap((row) => skillNames(row.specJson)));
  return attempt.skills.filter((skill) => !solved.has(skill)).length;
}

function skillNames(specJson: unknown): string[] {
  const parsed = manifestSkillsSchema.safeParse(specJson);
  return parsed.success ? Object.keys(parsed.data.skills) : [];
}

export const xpHandler: FinishedHandler = { group: "worker-xp", name: "credit XP", handle: creditSolve };
