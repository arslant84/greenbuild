import { type ReviewQueue, type ReviewResponse, reviewRequestSchema } from "@greenbuild/shared";
import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import type { AuthenticatedUser } from "../auth/dev-user-token.js";
import { CurrentUser } from "../auth/session.guard.js";
import { parseInput } from "../validation.js";
import { AdminGuard } from "./admin.guard.js";
import { Reviews } from "./reviews.js";

@Controller("v1/admin/reviews")
@UseGuards(AdminGuard)
export class ReviewsController {
  constructor(private readonly reviews: Reviews) {}

  @Get()
  queue(): Promise<ReviewQueue> {
    return this.reviews.queue();
  }

  @Post(":attemptId")
  decide(@CurrentUser() user: AuthenticatedUser, @Param("attemptId") attemptId: string, @Body() body: unknown): Promise<ReviewResponse> {
    return this.reviews.decide(user.id, parseInput(z.uuid(), attemptId), parseInput(reviewRequestSchema, body));
  }
}
