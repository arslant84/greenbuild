import { and, attempts, challenges, challengeVersions, dailyChallenges, desc, eq, sql } from "@greenbuild/db";
import { type DailyQuery, type DailyResponse, NotFoundError, utcDay } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient } from "../infra/services.js";
import { challengeCard } from "./challenge-card.js";

// DailyChallenges answers GET /v1/daily: the version the worker published for today, and the
// player's newest attempt at it since the day began (architecture.md, task 41b).
@Injectable()
export class DailyChallenges {
  constructor(private readonly database: DatabaseClient) {}

  async today(userId: string, query: DailyQuery, now = new Date()): Promise<DailyResponse> {
    const day = utcDay(now);
    const [daily] = await this.database.db
      .select({ slug: challenges.slug, id: challengeVersions.id, version: challengeVersions.version, imageRef: challengeVersions.imageRef, specJson: challengeVersions.specJson })
      .from(dailyChallenges)
      .innerJoin(challengeVersions, eq(challengeVersions.id, dailyChallenges.challengeVersionId))
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .where(and(eq(dailyChallenges.day, day), eq(dailyChallenges.track, query.track)));
    if (!daily) {
      throw new NotFoundError("No daily challenge published today");
    }
    const [attempt] = await this.database.db
      .select({ id: attempts.id, status: attempts.status })
      .from(attempts)
      .where(and(eq(attempts.userId, userId), eq(attempts.challengeVersionId, daily.id), sql`${attempts.createdAt} >= ${day}::date`))
      .orderBy(desc(attempts.createdAt))
      .limit(1);
    return { day, track: query.track, challenge: challengeCard(daily.slug, daily), attempt: attempt ?? null };
  }
}
