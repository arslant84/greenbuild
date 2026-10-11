import { type DeletionResponse, type MeResponse, updateMeRequestSchema } from "@greenbuild/shared";
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/dev-user-token.js";
import { CurrentUser } from "../auth/dev-user.guard.js";
import { parseInput } from "../validation.js";
import { AccountDeletion } from "./deletion.js";
import { MeService } from "./me.service.js";

@Controller("v1/me")
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly deletion: AccountDeletion,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    return this.me.get(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown): Promise<MeResponse> {
    return this.me.update(user.id, parseInput(updateMeRequestSchema, body));
  }

  // 202: the account is hidden now, its personal data goes later.
  @Delete()
  @HttpCode(HttpStatus.ACCEPTED)
  remove(@CurrentUser() user: AuthenticatedUser): Promise<DeletionResponse> {
    return this.deletion.request(user.id);
  }
}
