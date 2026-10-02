import { and, challenges, challengeVersions, desc, eq } from "@greenbuild/db";
import { NotFoundError } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient } from "../infra/services.js";

export interface LiveVersion {
  id: string;
  version: number;
  imageRef: string;
  specJson: unknown;
}

// LiveVersions finds what players get for a challenge: its newest version, while it is live.
@Injectable()
export class LiveVersions {
  constructor(private readonly database: DatabaseClient) {}

  async latest(slug: string): Promise<LiveVersion> {
    const [version] = await this.database.db
      .select({ id: challengeVersions.id, version: challengeVersions.version, imageRef: challengeVersions.imageRef, specJson: challengeVersions.specJson })
      .from(challengeVersions)
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .where(and(eq(challenges.slug, slug), eq(challenges.status, "live")))
      .orderBy(desc(challengeVersions.version))
      .limit(1);
    if (!version) {
      throw new NotFoundError("Challenge not found");
    }
    return version;
  }
}
