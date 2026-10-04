import type { AttemptResponse } from "@greenbuild/shared";
import { Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import type { AuthenticatedUser } from "../auth/dev-user-token.js";
import { CurrentUser, DevUserGuard } from "../auth/dev-user.guard.js";
import { parseInput } from "../validation.js";
import { AbandonService } from "./abandon.service.js";

@Controller("v1/attempts")
@UseGuards(DevUserGuard)
export class AbandonController {
  constructor(private readonly abandonment: AbandonService) {}

  @Post(":id/abandon")
  @HttpCode(HttpStatus.OK)
  abandon(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<AttemptResponse> {
    return this.abandonment.abandon(user.id, parseInput(z.uuid(), id));
  }
}
