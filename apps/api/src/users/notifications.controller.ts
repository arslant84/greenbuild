import { type Notifications, notificationsSchema } from "@greenbuild/shared";
import { Body, Controller, Get, Put } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/api-token.js";
import { CurrentUser } from "../auth/session.guard.js";
import { parseInput } from "../validation.js";
import { NotificationSettings } from "./notifications.js";

@Controller("v1/me/notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationSettings) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<Notifications> {
    return this.notifications.get(user.id);
  }

  @Put()
  set(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown): Promise<Notifications> {
    return this.notifications.set(user.id, parseInput(notificationsSchema, body));
  }
}
