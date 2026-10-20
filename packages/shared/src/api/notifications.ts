import { z } from "zod";

// The local hour a streak reminder goes at when the player picks none (task 52; "in the evening",
// architecture.md).
export const DEFAULT_REMINDER_HOUR = 19;
const LAST_HOUR = 23;

// GET and PUT /v1/me/notifications (task 52): the daily streak reminder by email, opt-in, and the local
// hour it goes at. PUT replaces both.
export const notificationsSchema = z.strictObject({
  streak_reminder_email: z.boolean(),
  reminder_hour: z.number().int().min(0).max(LAST_HOUR),
});

export type Notifications = z.infer<typeof notificationsSchema>;
