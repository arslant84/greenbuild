import {
  type AttemptListResponse,
  type AttemptResponse,
  type AttemptResult,
  type CheckResponse,
  listAttemptsQuerySchema,
  startAttemptRequestSchema,
} from "@greenbuild/shared";
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import type { AuthenticatedUser } from "../auth/dev-user-token.js";
import { CurrentUser, DevUserGuard } from "../auth/dev-user.guard.js";
import { parseInput } from "../validation.js";
import { AttemptReader } from "./attempt-reader.js";
import { AttemptsService } from "./attempts.service.js";
import { ChecksService } from "./checks.service.js";

@Controller("v1/attempts")
@UseGuards(DevUserGuard)
export class AttemptsController {
  constructor(
    private readonly attempts: AttemptsService,
    private readonly reader: AttemptReader,
    private readonly checks: ChecksService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  start(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown): Promise<AttemptResponse> {
    const request = parseInput(startAttemptRequestSchema, body);
    return this.attempts.start(user.id, request.challenge_slug);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown): Promise<AttemptListResponse> {
    parseInput(listAttemptsQuerySchema, query);
    return this.reader.listActive(user.id);
  }

  @Get(":id")
  find(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<AttemptResponse> {
    return this.reader.find(user.id, parseInput(z.uuid(), id));
  }

  @Post(":id/check")
  @HttpCode(HttpStatus.OK)
  check(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<CheckResponse> {
    return this.checks.check(user.id, parseInput(z.uuid(), id));
  }

  @Get(":id/result")
  result(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<AttemptResult> {
    return this.checks.result(user.id, parseInput(z.uuid(), id));
  }
}
