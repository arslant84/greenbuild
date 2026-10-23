import { randomBytes } from "node:crypto";
import { and, attemptChecks, attempts, challengeVersions, type Database, eq, isNull, shareTokens, sql, streakToday, users, xpLedger } from "@greenbuild/db";
import { challengeManifestSchema, ConflictError, NotFoundError, SHARE_TOKEN_BYTES, type ShareCard, type ShareCreated } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient } from "../infra/services.js";

// What the card needs from a published manifest; a manifest has more fields.
const cardManifestSchema = challengeManifestSchema.pick({ title: true, skills: true }).loose();

// ShareCards gives a solved attempt its share link and answers the public card behind it (task 51).
@Injectable()
export class ShareCards {
  constructor(private readonly database: DatabaseClient) {}

  // share answers the attempt's live token, making one on first use. Two requests at once make one: the
  // partial unique index keeps a single live token, and both read it back.
  async share(userId: string, attemptId: string): Promise<ShareCreated> {
    if ((await this.ownedStatus(userId, attemptId)) !== "solved") {
      throw new ConflictError("Only a solved attempt can be shared");
    }
    const { db } = this.database;
    await db.insert(shareTokens).values({ token: randomBytes(SHARE_TOKEN_BYTES).toString("base64url"), userId, attemptId }).onConflictDoNothing();
    const [live] = await db
      .select({ token: shareTokens.token })
      .from(shareTokens)
      .where(and(eq(shareTokens.attemptId, attemptId), isNull(shareTokens.revokedAt)));
    if (!live) {
      throw new Error(`share token for attempt ${attemptId} was not stored`);
    }
    return { token: live.token };
  }

  // revoke kills the attempt's live link; the next share makes a new one.
  async revoke(userId: string, attemptId: string): Promise<void> {
    await this.ownedStatus(userId, attemptId);
    await this.database.db
      .update(shareTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(shareTokens.attemptId, attemptId), isNull(shareTokens.revokedAt)));
  }

  // card answers the same 404 for an unknown or revoked token and for a banned or deleted player.
  async card(token: string): Promise<ShareCard> {
    const { db } = this.database;
    const [row] = await db
      .select({ user: users, attempt: attempts, specJson: challengeVersions.specJson })
      .from(shareTokens)
      .innerJoin(users, and(eq(users.id, shareTokens.userId), eq(users.status, "active"), isNull(users.deletedAt)))
      .innerJoin(attempts, and(eq(attempts.id, shareTokens.attemptId), eq(attempts.status, "solved")))
      .innerJoin(challengeVersions, eq(challengeVersions.id, attempts.challengeVersionId))
      .where(and(eq(shareTokens.token, token), isNull(shareTokens.revokedAt)));
    if (!row) {
      throw new NotFoundError("Share card not found");
    }
    const manifest = cardManifestSchema.parse(row.specJson);
    return {
      display_name: row.user.displayName,
      handle: row.user.handle,
      challenge_title: manifest.title,
      skills: Object.keys(manifest.skills),
      duration_ms: row.attempt.durationMs,
      xp_earned: await xpEarned(db, row.attempt.id),
      checks_passed: await checksPassed(db, row.attempt.id),
      checks_used: row.attempt.checksUsed,
      streak: (await streakToday(db, row.user)).current,
      solved_at: (row.attempt.finishedAt ?? row.attempt.updatedAt).toISOString(),
    };
  }

  // ownedStatus is the attempt's status for its owner; someone else's or a missing attempt is not found.
  private async ownedStatus(userId: string, attemptId: string): Promise<string> {
    const [attempt] = await this.database.db.select({ userId: attempts.userId, status: attempts.status }).from(attempts).where(eq(attempts.id, attemptId));
    if (!attempt || attempt.userId !== userId) {
      throw new NotFoundError("Attempt not found");
    }
    return attempt.status;
  }
}

// The worker credits XP after attempt.finished, so a fresh solve has none yet: the sum is null.
async function xpEarned(db: Database, attemptId: string): Promise<number | null> {
  const [xp] = await db.select({ earned: sql<number | null>`sum(${xpLedger.amount})::int` }).from(xpLedger).where(eq(xpLedger.attemptId, attemptId));
  return xp?.earned ?? null;
}

async function checksPassed(db: Database, attemptId: string): Promise<number> {
  const [passed] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(attemptChecks)
    .where(and(eq(attemptChecks.attemptId, attemptId), eq(attemptChecks.passed, true)));
  return passed?.count ?? 0;
}
