import { type Database, eq, users, userSettings } from "@greenbuild/db";
import { ConflictError, levelForXp, type MeResponse, NotFoundError, TIMEZONE_CHANGE_INTERVAL_DAYS, type UpdateMeRequest } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { violatesUnique } from "../infra/postgres-errors.js";
import { DatabaseClient } from "../infra/services.js";
import { type Progress, progressOf } from "./progress.js";

const DAY_MS = 86_400_000;
const TIMEZONE_INTERVAL_MS = TIMEZONE_CHANGE_INTERVAL_DAYS * DAY_MS;
const HANDLE_TAKEN = "users_handle_unique";

type UserRow = typeof users.$inferSelect;

// MeService reads and edits the signed-in player's own profile (architecture.md, task 32).
@Injectable()
export class MeService {
  constructor(private readonly database: DatabaseClient) {}

  async get(userId: string): Promise<MeResponse> {
    const { db } = this.database;
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return toResponse(user, await isProfilePublic(db, userId), await progressOf(db, user));
  }

  // update locks the row, so two timezone changes at once cannot both pass the 30-day rule.
  async update(userId: string, changes: UpdateMeRequest): Promise<MeResponse> {
    try {
      return await this.database.db.transaction(async (tx) => {
        const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
        if (!user) {
          throw new NotFoundError("User not found");
        }
        const columns = columnsFor(user, changes);
        let current = user;
        if (Object.keys(columns).length > 0) {
          const [updated] = await tx.update(users).set(columns).where(eq(users.id, userId)).returning();
          current = updated ?? user;
        }
        const isPublic = changes.game_profile_public ?? (await isProfilePublic(tx, userId));
        if (changes.game_profile_public !== undefined) {
          await tx
            .insert(userSettings)
            .values({ userId, gameProfilePublic: isPublic })
            .onConflictDoUpdate({ target: userSettings.userId, set: { gameProfilePublic: isPublic } });
        }
        return toResponse(current, isPublic, await progressOf(tx, current));
      });
    } catch (error) {
      if (violatesUnique(error, HANDLE_TAKEN)) {
        throw new ConflictError("Handle is taken");
      }
      throw error;
    }
  }
}

function columnsFor(user: UserRow, changes: UpdateMeRequest): Partial<UserRow> {
  const columns: Partial<UserRow> = {};
  if (changes.handle !== undefined) {
    columns.handle = changes.handle;
  }
  if (changes.display_name !== undefined) {
    columns.displayName = changes.display_name;
  }
  if (changes.locale !== undefined) {
    columns.locale = changes.locale;
  }
  if (changes.country !== undefined) {
    columns.country = changes.country;
  }
  if (changes.timezone !== undefined && changes.timezone !== user.timezone) {
    const lockedUntil = timezoneLockedUntil(user);
    if (lockedUntil) {
      throw new ConflictError(`The timezone can change once in ${TIMEZONE_CHANGE_INTERVAL_DAYS} days`, { timezone_locked_until: lockedUntil.toISOString() });
    }
    columns.timezone = changes.timezone;
    columns.timezoneChangedAt = new Date();
  }
  return columns;
}

function timezoneLockedUntil(user: UserRow, now = new Date()): Date | null {
  if (!user.timezoneChangedAt) {
    return null;
  }
  const until = new Date(user.timezoneChangedAt.getTime() + TIMEZONE_INTERVAL_MS);
  return until > now ? until : null;
}

// isProfilePublic: no settings row means the defaults, where the game profile is public (as task 46a reads it).
async function isProfilePublic(db: Pick<Database, "select">, userId: string): Promise<boolean> {
  const [settings] = await db.select({ isPublic: userSettings.gameProfilePublic }).from(userSettings).where(eq(userSettings.userId, userId));
  return settings?.isPublic !== false;
}

function toResponse(user: UserRow, isPublic: boolean, { xp, streak }: Progress): MeResponse {
  return {
    id: user.id,
    handle: user.handle,
    display_name: user.displayName,
    email: user.email,
    country: user.country,
    game_profile_public: isPublic,
    timezone: user.timezone,
    timezone_locked_until: timezoneLockedUntil(user)?.toISOString() ?? null,
    locale: user.locale,
    xp: xp.total,
    level: levelForXp(xp.total),
    xp_today: xp.today,
    streak,
  };
}
