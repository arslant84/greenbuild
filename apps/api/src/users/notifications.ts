import { eq, users, userSettings } from "@greenbuild/db";
import { DEFAULT_REMINDER_HOUR, NotFoundError, type Notifications, UnprocessableError } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient } from "../infra/services.js";

// NotificationSettings holds the player's streak reminder choice (task 52): by email, opt-in, at a local
// hour. A reminder needs an address, so a player without one cannot turn it on.
@Injectable()
export class NotificationSettings {
  constructor(private readonly database: DatabaseClient) {}

  // get answers the player's choice; a player without settings gets no reminder, at the default hour.
  async get(userId: string): Promise<Notifications> {
    const [found] = await this.database.db
      .select({ notifyEmail: userSettings.notifyEmail, reminderHour: userSettings.reminderHour })
      .from(users)
      .leftJoin(userSettings, eq(userSettings.userId, users.id))
      .where(eq(users.id, userId));
    if (!found) {
      throw new NotFoundError("User not found");
    }
    return { streak_reminder_email: found.notifyEmail ?? false, reminder_hour: found.reminderHour ?? DEFAULT_REMINDER_HOUR };
  }

  async set(userId: string, request: Notifications): Promise<Notifications> {
    const [user] = await this.database.db.select({ email: users.email }).from(users).where(eq(users.id, userId));
    if (!user) {
      throw new NotFoundError("User not found");
    }
    if (request.streak_reminder_email && !user.email) {
      throw new UnprocessableError("Add an email address to get streak reminders");
    }
    const values = { notifyEmail: request.streak_reminder_email, reminderHour: request.reminder_hour };
    await this.database.db
      .insert(userSettings)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: userSettings.userId, set: values });
    return request;
  }

  // unsubscribe turns the reminders off for the player whose link carries token. It answers nothing either
  // way, so a token reveals no account.
  async unsubscribe(token: string): Promise<void> {
    await this.database.db.update(userSettings).set({ notifyEmail: false }).where(eq(userSettings.unsubscribeToken, token));
  }
}
