import { type Database, eq, sql, streaks, users, xpLedger } from "@greenbuild/db";
import {
  ConflictError,
  levelForXp,
  localDay,
  type MeResponse,
  NO_STREAK,
  NotFoundError,
  TIMEZONE_CHANGE_INTERVAL_DAYS,
  type UpdateMeRequest,
  visibleStreak,
} from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { violatesUnique } from "../infra/postgres-errors.js";
import { DatabaseClient } from "../infra/services.js";

const DAY_MS = 86_400_000;
const TIMEZONE_INTERVAL_MS = TIMEZONE_CHANGE_INTERVAL_DAYS * DAY_MS;
const HANDLE_TAKEN = "users_handle_unique";

type UserRow = typeof users.$inferSelect;

interface XpSummary {
  total: number;
  today: number;
}

interface Progress {
  xp: XpSummary;
  streak: MeResponse["streak"];
}

// MeService reads and edits the signed-in player's own profile (architecture.md, task 32).
@Injectable()
export class MeService {
  constructor(private readonly database: DatabaseClient) {}

  async get(userId: string): Promise<MeResponse> {
    const [user] = await this.database.db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return toResponse(user, await progressOf(this.database.db, user));
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
        return toResponse(current, await progressOf(tx, current));
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

// xpSummary sums the player's XP in total and since midnight in their timezone (task 42b).
async function xpSummary(db: Pick<Database, "select">, user: UserRow): Promise<XpSummary> {
  const startOfToday = sql`(date_trunc('day', now() at time zone ${user.timezone}) at time zone ${user.timezone})`;
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int`,
      today: sql<number>`coalesce(sum(${xpLedger.amount}) filter (where ${xpLedger.createdAt} >= ${startOfToday}), 0)::int`,
    })
    .from(xpLedger)
    .where(eq(xpLedger.userId, user.id));
  return { total: row?.total ?? 0, today: row?.today ?? 0 };
}

// streakToday is the player's streak as it stands on their calendar day today (task 44).
async function streakToday(db: Pick<Database, "select">, user: UserRow): Promise<MeResponse["streak"]> {
  const [row] = await db.select().from(streaks).where(eq(streaks.userId, user.id));
  const state = row ? { current: row.current, longest: row.longest, lastDay: row.lastDay, freezes: row.freezesAvailable } : NO_STREAK;
  return { current: visibleStreak(state, localDay(new Date(), user.timezone)), longest: state.longest, freezes: state.freezes };
}

async function progressOf(db: Pick<Database, "select">, user: UserRow): Promise<Progress> {
  return { xp: await xpSummary(db, user), streak: await streakToday(db, user) };
}

function toResponse(user: UserRow, { xp, streak }: Progress): MeResponse {
  return {
    id: user.id,
    handle: user.handle,
    display_name: user.displayName,
    timezone: user.timezone,
    timezone_locked_until: timezoneLockedUntil(user)?.toISOString() ?? null,
    locale: user.locale,
    xp: xp.total,
    level: levelForXp(xp.total),
    xp_today: xp.today,
    streak,
  };
}
