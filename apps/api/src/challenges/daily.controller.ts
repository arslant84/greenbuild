import { type DailyResponse, dailyQuerySchema } from "@greenbuild/shared";
import { Controller, Get, Query } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/dev-user-token.js";
import { CurrentUser } from "../auth/dev-user.guard.js";
import { parseInput } from "../validation.js";
import { DailyChallenges } from "./daily.js";

@Controller("v1/daily")
export class DailyController {
  constructor(private readonly daily: DailyChallenges) {}

  @Get()
  today(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown): Promise<DailyResponse> {
    return this.daily.today(user.id, parseInput(dailyQuerySchema, query));
  }
}
