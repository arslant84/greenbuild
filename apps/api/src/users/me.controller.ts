import { type MeResponse, updateMeRequestSchema } from "@greenbuild/shared";
import { Body, Controller, Get, Patch } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/dev-user-token.js";
import { CurrentUser } from "../auth/dev-user.guard.js";
import { parseInput } from "../validation.js";
import { MeService } from "./me.service.js";

@Controller("v1/me")
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    return this.me.get(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown): Promise<MeResponse> {
    return this.me.update(user.id, parseInput(updateMeRequestSchema, body));
  }
}
