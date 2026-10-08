import { and, challenges, challengeVersions, desc, eq, sql } from "@greenbuild/db";
import type { ChallengeList, ChallengeListQuery } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient } from "../infra/services.js";
import { challengeCard } from "./challenge-card.js";

// Catalog lists live public challenges, newest first. Skills and difficulty come from each one's latest
// version, as its card shows them; ids are UUID v7, so id order is creation order and the cursor.
@Injectable()
export class Catalog {
  constructor(private readonly database: DatabaseClient) {}

  async page(query: ChallengeListQuery): Promise<ChallengeList> {
    const db = this.database.db;
    const latest = db
      .selectDistinctOn([challengeVersions.challengeId], {
        challengeId: challengeVersions.challengeId,
        version: challengeVersions.version,
        imageRef: challengeVersions.imageRef,
        specJson: challengeVersions.specJson,
        id: challengeVersions.id,
      })
      .from(challengeVersions)
      .orderBy(challengeVersions.challengeId, desc(challengeVersions.version))
      .as("latest");
    const rows = await db
      .select({ challengeId: challenges.id, slug: challenges.slug, id: latest.id, version: latest.version, imageRef: latest.imageRef, specJson: latest.specJson })
      .from(challenges)
      .innerJoin(latest, eq(latest.challengeId, challenges.id))
      .where(
        and(
          eq(challenges.status, "live"),
          eq(challenges.visibility, "public"),
          query.skill === undefined ? undefined : sql`${latest.specJson} -> 'skills' ? ${query.skill}`,
          sql`(${latest.specJson} ->> 'difficulty')::int between ${query.difficulty_min ?? 1} and ${query.difficulty_max ?? 10}`,
          query.cursor === undefined ? undefined : sql`${challenges.id} < ${query.cursor}`,
        ),
      )
      .orderBy(desc(challenges.id))
      .limit(query.limit + 1);
    const shown = rows.slice(0, query.limit);
    return {
      challenges: shown.map((row) => challengeCard(row.slug, row)),
      next_cursor: rows.length > query.limit ? (shown.at(-1)?.challengeId ?? null) : null,
    };
  }
}
