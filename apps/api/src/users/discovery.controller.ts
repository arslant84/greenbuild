import { type DiscoveryResponse, discoveryRequestSchema } from "@greenbuild/shared";
import { Body, Controller, Get, Put } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/api-token.js";
import { CurrentUser } from "../auth/session.guard.js";
import { parseInput } from "../validation.js";
import { Discovery } from "./discovery.js";

@Controller("v1/me/discovery")
export class DiscoveryController {
  constructor(private readonly discovery: Discovery) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<DiscoveryResponse> {
    return this.discovery.get(user.id);
  }

  @Put()
  set(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown): Promise<DiscoveryResponse> {
    return this.discovery.set(user.id, parseInput(discoveryRequestSchema, body));
  }
}
