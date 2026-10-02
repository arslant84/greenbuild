import { type AttemptResponse, startAttemptRequestSchema } from "@greenbuild/shared";
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import type { AuthenticatedUser } from "../auth/dev-user-token.js";
import { CurrentUser, DevUserGuard } from "../auth/dev-user.guard.js";
import { parseInput } from "../validation.js";
import { AttemptsService } from "./attempts.service.js";

@Controller("v1/attempts")
@UseGuards(DevUserGuard)
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  start(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown): Promise<AttemptResponse> {
    const request = parseInput(startAttemptRequestSchema, body);
    return this.attempts.start(user.id, request.challenge_slug);
  }

  @Get(":id")
  find(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<AttemptResponse> {
    return this.attempts.find(user.id, parseInput(z.uuid(), id));
  }
}
