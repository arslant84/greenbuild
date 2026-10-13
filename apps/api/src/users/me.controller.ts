import { type DeletionResponse, type ExportRequestResponse, type MeResponse, updateMeRequestSchema } from "@greenbuild/shared";
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/dev-user-token.js";
import { CurrentUser } from "../auth/session.guard.js";
import { parseInput } from "../validation.js";
import { DataExport } from "./data-export.js";
import { AccountDeletion } from "./deletion.js";
import { MeService } from "./me.service.js";

@Controller("v1/me")
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly deletion: AccountDeletion,
    private readonly dataExport: DataExport,
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

  // 202: the archive is built and emailed later.
  @Post("export")
  @HttpCode(HttpStatus.ACCEPTED)
  requestExport(@CurrentUser() user: AuthenticatedUser): Promise<ExportRequestResponse> {
    return this.dataExport.request(user.id);
  }
}
