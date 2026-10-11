import { LEADERBOARD_KINDS, type LeaderboardResponse, leaderboardQuerySchema } from "@greenbuild/shared";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { z } from "zod";
import type { AuthenticatedUser } from "../auth/dev-user-token.js";
import { CurrentUser } from "../auth/dev-user.guard.js";
import { parseInput } from "../validation.js";
import { Leaderboards } from "./leaderboards.js";

@Controller("v1/leaderboards")
export class LeaderboardsController {
  constructor(private readonly leaderboards: Leaderboards) {}

  @Get(":kind")
  read(@CurrentUser() user: AuthenticatedUser, @Param("kind") kind: string, @Query() query: unknown): Promise<LeaderboardResponse> {
    return this.leaderboards.read(user.id, parseInput(z.enum(LEADERBOARD_KINDS), kind), parseInput(leaderboardQuerySchema, query));
  }
}
