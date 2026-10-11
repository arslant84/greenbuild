import { z } from "zod";
import { DISPLAY_NAME_MAX, HANDLE_MAX, HANDLE_MIN } from "../constants/index.js";

// A handle is how others find a player: lowercase letters, digits and inner hyphens. Input is
// lowercased first, so "Arslan" and "arslan" are the same handle.
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(HANDLE_MIN)
  .max(HANDLE_MAX)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "letters, digits and inner hyphens only");

// isTimeZone accepts what the runtime's Intl knows, e.g. "Europe/Berlin" or "UTC".
function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// A BCP 47 language with an optional region, e.g. "en" or "ru-KZ".
const localeSchema = z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/, "a language like en or en-US");

// GET /v1/me and the PATCH answer: the signed-in player's own profile.
export const meResponseSchema = z.object({
  id: z.uuid(),
  handle: z.string().nullable(),
  display_name: z.string().nullable(),
  timezone: z.string(),
  // When the timezone may change again; null when it may change now.
  timezone_locked_until: z.iso.datetime().nullable(),
  locale: z.string(),
  // XP in total, the level it reaches, and XP earned since midnight in the player's timezone (task 42b).
  xp: z.number().int().nonnegative(),
  level: z.number().int().nonnegative(),
  xp_today: z.number().int().nonnegative(),
  // The streak as it stands today: current is 0 once missed days outran the freezes (task 44).
  streak: z.object({ current: z.number().int().nonnegative(), longest: z.number().int().nonnegative(), freezes: z.number().int().nonnegative() }),
});

// PATCH /v1/me: any subset of the editable fields.
export const updateMeRequestSchema = z
  .strictObject({
    handle: handleSchema,
    display_name: z.string().trim().min(1).max(DISPLAY_NAME_MAX),
    timezone: z.string().refine(isTimeZone, "an IANA time zone like Europe/Berlin"),
    locale: localeSchema,
  })
  .partial();

export type MeResponse = z.infer<typeof meResponseSchema>;
export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>;

// architecture.md, "Права пользователя" (task 50b): an account is hidden at once and its personal data
// deleted this many days later.
export const ACCOUNT_DELETION_DAYS = 30;

// DELETE /v1/me answers when the personal data will be gone.
export const deletionResponseSchema = z.object({ deletion_scheduled_for: z.iso.datetime() });

export type DeletionResponse = z.infer<typeof deletionResponseSchema>;
