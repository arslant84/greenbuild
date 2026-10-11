import { eq, inArray, users, userSettings } from "@greenbuild/db";
import { isoWeek, type LeaderboardKind, type LeaderboardQuery, type LeaderboardResponse, leaderboardKeys, utcDay, ValidationError } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient, RedisClient, type RedisConnection } from "../infra/services.js";

interface Board {
  key: string;
  // Daily boards rank solve times, so the lowest score is first.
  lowestFirst: boolean;
}

interface Name {
  handle: string | null;
  display_name: string | null;
}

const ANONYMOUS: Name = { handle: null, display_name: null };

// boardFor picks the sorted set the worker keeps for a board (architecture.md, "Лидерборды", task 45b).
export function boardFor(kind: LeaderboardKind, query: LeaderboardQuery, now: Date): Board {
  if (kind === "skill") {
    if (!query.skill) {
      throw new ValidationError("skill is required for the skill board");
    }
    return { key: leaderboardKeys.skill(query.skill), lowestFirst: false };
  }
  if (kind === "daily") {
    return { key: leaderboardKeys.daily(utcDay(now), query.track), lowestFirst: true };
  }
  const week = isoWeek(now);
  return { key: query.country ? leaderboardKeys.countryWeekly(query.country, week) : leaderboardKeys.globalWeekly(week), lowestFirst: false };
}

// Leaderboards reads a board from Redis and names its players. A player whose game profile is not
// public is listed without a name.
@Injectable()
export class Leaderboards {
  constructor(
    private readonly redis: RedisClient,
    private readonly database: DatabaseClient,
  ) {}

  async read(userId: string, kind: LeaderboardKind, query: LeaderboardQuery): Promise<LeaderboardResponse> {
    const board = boardFor(kind, query, new Date());
    const client = await this.redis.connected();
    const members = await client.zRangeWithScores(board.key, 0, query.limit - 1, board.lowestFirst ? undefined : { REV: true });
    const names = await this.names(members.map((member) => member.value));
    const entries = members.map((member, index) => ({ rank: index + 1, ...(names.get(member.value) ?? ANONYMOUS), score: member.score }));
    return { kind, entries, me: await place(client, board, userId) };
  }

  private async names(userIds: string[]): Promise<Map<string, Name>> {
    if (userIds.length === 0) {
      return new Map();
    }
    const rows = await this.database.db
      .select({ id: users.id, handle: users.handle, displayName: users.displayName, isPublic: userSettings.gameProfilePublic })
      .from(users)
      .leftJoin(userSettings, eq(userSettings.userId, users.id))
      .where(inArray(users.id, userIds));
    // No settings row means the defaults, where the game profile is public.
    return new Map(rows.map((row) => [row.id, row.isPublic === false ? ANONYMOUS : { handle: row.handle, display_name: row.displayName }]));
  }
}

async function place(client: RedisConnection, board: Board, userId: string): Promise<LeaderboardResponse["me"]> {
  const rank = board.lowestFirst ? await client.zRank(board.key, userId) : await client.zRevRank(board.key, userId);
  const score = await client.zScore(board.key, userId);
  return rank === null || score === null ? null : { rank: rank + 1, score };
}
