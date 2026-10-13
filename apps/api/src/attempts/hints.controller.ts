import type { HintResponse } from "@greenbuild/shared";
import { Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import type { AuthenticatedUser } from "../auth/dev-user-token.js";
import { CurrentUser, SessionGuard } from "../auth/session.guard.js";
import { parseInput } from "../validation.js";
import { HintsService } from "./hints.service.js";

@Controller("v1/attempts")
@UseGuards(SessionGuard)
export class HintsController {
  constructor(private readonly hints: HintsService) {}

  @Post(":id/hint")
  @HttpCode(HttpStatus.OK)
  next(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<HintResponse> {
    return this.hints.next(user.id, parseInput(z.uuid(), id));
  }
}
