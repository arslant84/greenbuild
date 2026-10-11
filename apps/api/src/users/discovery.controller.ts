import { type DiscoveryResponse, discoveryRequestSchema } from "@greenbuild/shared";
import { Body, Controller, Put } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/dev-user-token.js";
import { CurrentUser } from "../auth/dev-user.guard.js";
import { parseInput } from "../validation.js";
import { Discovery } from "./discovery.js";

@Controller("v1/me/discovery")
export class DiscoveryController {
  constructor(private readonly discovery: Discovery) {}

  @Put()
  set(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown): Promise<DiscoveryResponse> {
    return this.discovery.set(user.id, parseInput(discoveryRequestSchema, body));
  }
}
