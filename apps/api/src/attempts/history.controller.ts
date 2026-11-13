import { type AttemptHistoryResponse, attemptHistoryQuerySchema } from "@greenbuild/shared";
import { Controller, Get, Query } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/api-token.js";
import { CurrentUser } from "../auth/session.guard.js";
import { parseInput } from "../validation.js";
import { AttemptHistory } from "./attempt-history.js";

// GET /v1/me/attempts: the signed-in player's finished attempts, newest first.
@Controller("v1/me/attempts")
export class HistoryController {
  constructor(private readonly history: AttemptHistory) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown): Promise<AttemptHistoryResponse> {
    return this.history.list(user.id, parseInput(attemptHistoryQuerySchema, query).limit);
  }
}
