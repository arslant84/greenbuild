import type { ConsentHistory } from "@greenbuild/shared";
import { Controller, Get } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/api-token.js";
import { CurrentUser } from "../auth/session.guard.js";
import { Consents } from "./consents.js";

@Controller("v1/me/consents")
export class ConsentsController {
  constructor(private readonly consents: Consents) {}

  @Get()
  history(@CurrentUser() user: AuthenticatedUser): Promise<ConsentHistory> {
    return this.consents.history(user.id);
  }
}
