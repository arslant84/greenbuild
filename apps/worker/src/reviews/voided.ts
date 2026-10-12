import { and, attempts, cheatReviews, type Database, eq, sql } from "@greenbuild/db";

// An attempt a review voided or banned (task 49c) counts for nothing: no XP, streak day or daily time.

// isVoided answers whether a review voided or banned the attempt.
export async function isVoided(db: Pick<Database, "select">, attemptId: string): Promise<boolean> {
  const [review] = await db
    .select({ id: cheatReviews.id })
    .from(cheatReviews)
    .where(and(eq(cheatReviews.attemptId, attemptId), sql`${cheatReviews.decision} <> 'clear'`));
  return review !== undefined;
}

// notVoided keeps, in a query over attempts, the attempts no review voided or banned.
export const notVoided = sql`not exists (select 1 from ${cheatReviews} where ${cheatReviews.attemptId} = ${attempts.id} and ${cheatReviews.decision} <> 'clear')`;
