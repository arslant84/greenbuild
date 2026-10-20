import { unsubscribeRequestSchema } from "@greenbuild/shared";
import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Public } from "../auth/public.js";
import { parseInput } from "../validation.js";
import { NotificationSettings } from "./notifications.js";

// Public: the one-click unsubscribe from a reminder email (task 52), which works without signing in. Listed
// in architecture.md's API rules, checked by the route test (task 30c).
@Controller("v1/notifications/unsubscribe")
export class UnsubscribeController {
  constructor(private readonly notifications: NotificationSettings) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  unsubscribe(@Body() body: unknown): Promise<void> {
    return this.notifications.unsubscribe(parseInput(unsubscribeRequestSchema, body).token);
  }
}
