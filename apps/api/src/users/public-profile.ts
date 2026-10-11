import { and, attempts, desc, eq, sql, users, userSettings, userSkills } from "@greenbuild/db";
import { levelForXp, NotFoundError, type PublicProfile, RATING_CONFIDENCE_Z } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient } from "../infra/services.js";
import { progressOf } from "./progress.js";

// PublicProfiles answers GET /v1/users/{handle} (architecture.md, task 46a). A profile the player made
// private, a banned or deleted account and an unknown handle all answer the same 404, so the endpoint
// does not reveal which handles exist.
@Injectable()
export class PublicProfiles {
  constructor(private readonly database: DatabaseClient) {}

  async byHandle(handle: string): Promise<PublicProfile> {
    const { db } = this.database;
    const [found] = await db
      .select({ user: users, isPublic: userSettings.gameProfilePublic })
      .from(users)
      .leftJoin(userSettings, eq(userSettings.userId, users.id))
      .where(and(eq(users.handle, handle), eq(users.status, "active"), sql`${users.deletedAt} is null`));
    // No settings row means the defaults, where the game profile is public.
    if (!found || found.isPublic === false) {
      throw new NotFoundError("Profile not found");
    }
    const { user } = found;
    const progress = await progressOf(db, user);
    const [solved] = await db.select({ count: sql<number>`count(*)::int` }).from(attempts).where(and(eq(attempts.userId, user.id), eq(attempts.status, "solved")));
    const skills = await db.select().from(userSkills).where(eq(userSkills.userId, user.id)).orderBy(desc(userSkills.rating));
    return {
      handle,
      display_name: user.displayName,
      level: levelForXp(progress.xp.total),
      xp: progress.xp.total,
      solved: solved?.count ?? 0,
      streak: { current: progress.streak.current, longest: progress.streak.longest },
      skills: skills.map((skill) => {
        const margin = RATING_CONFIDENCE_Z * skill.ratingDeviation;
        return { skill: skill.skill, rating: Math.round(skill.rating), interval: [Math.round(skill.rating - margin), Math.round(skill.rating + margin)], attempts: skill.attemptsCount };
      }),
    };
  }
}
