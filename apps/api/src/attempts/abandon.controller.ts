import type { AttemptResponse } from "@greenbuild/shared";
import { Controller, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { z } from "zod";
import type { AuthenticatedUser } from "../auth/api-token.js";
import { CurrentUser } from "../auth/session.guard.js";
import { parseInput } from "../validation.js";
import { AbandonService } from "./abandon.service.js";

@Controller("v1/attempts")
export class AbandonController {
  constructor(private readonly abandonment: AbandonService) {}

  @Post(":id/abandon")
  @HttpCode(HttpStatus.OK)
  abandon(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<AttemptResponse> {
    return this.abandonment.abandon(user.id, parseInput(z.uuid(), id));
  }
}
