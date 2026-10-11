import { and, challenges, challengeVersions, dailyChallenges, desc, eq } from "@greenbuild/db";
import { NotFoundError, utcDay } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient } from "../infra/services.js";

export interface LiveVersion {
  id: string;
  version: number;
  imageRef: string;
  specJson: unknown;
}

// LiveVersions finds what players get for a challenge: its newest version, while the challenge is live
// and that version is not retired (task 49d).
@Injectable()
export class LiveVersions {
  constructor(private readonly database: DatabaseClient) {}

  async latest(slug: string): Promise<LiveVersion> {
    const [version] = await this.database.db
      .select({ id: challengeVersions.id, version: challengeVersions.version, imageRef: challengeVersions.imageRef, specJson: challengeVersions.specJson, retiredReason: challengeVersions.retiredReason })
      .from(challengeVersions)
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .where(and(eq(challenges.slug, slug), eq(challenges.status, "live")))
      .orderBy(desc(challengeVersions.version))
      .limit(1);
    if (!version || version.retiredReason !== null) {
      throw new NotFoundError("Challenge not found");
    }
    return version;
  }

  // isTodaysDaily reports whether a version is today's daily challenge on any track, so an attempt at it
  // counts as daily (x1.5 XP, task 42a). The server decides, not the client.
  async isTodaysDaily(versionId: string, now = new Date()): Promise<boolean> {
    const [daily] = await this.database.db
      .select({ id: dailyChallenges.id })
      .from(dailyChallenges)
      .where(and(eq(dailyChallenges.day, utcDay(now)), eq(dailyChallenges.challengeVersionId, versionId)))
      .limit(1);
    return daily !== undefined;
  }
}
