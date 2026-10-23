import { type ShareCard, type ShareCreated, shareTokenSchema } from "@greenbuild/shared";
import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import type { AuthenticatedUser } from "../auth/api-token.js";
import { Public } from "../auth/public.js";
import { CurrentUser, SessionGuard } from "../auth/session.guard.js";
import { parseInput } from "../validation.js";
import { ShareCards } from "./share.service.js";

// The owner makes or revokes a solved attempt's share link (task 51).
@Controller("v1/attempts")
@UseGuards(SessionGuard)
export class ShareController {
  constructor(private readonly shares: ShareCards) {}

  @Post(":id/share")
  @HttpCode(HttpStatus.OK)
  share(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<ShareCreated> {
    return this.shares.share(user.id, parseInput(z.uuid(), id));
  }

  @Delete(":id/share")
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    return this.shares.revoke(user.id, parseInput(z.uuid(), id));
  }
}

// Public: the card behind a share link, which anyone with the link may see (task 51). Listed in
// architecture.md's API rules, checked by the route test (task 30c).
@Controller("v1/share")
export class PublicShareController {
  constructor(private readonly shares: ShareCards) {}

  @Public()
  @Get(":token")
  card(@Param("token") token: string): Promise<ShareCard> {
    return this.shares.card(parseInput(shareTokenSchema, token));
  }
}
