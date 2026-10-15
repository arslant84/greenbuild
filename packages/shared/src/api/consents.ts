import { z } from "zod";

export const CONSENT_KINDS = ["terms", "privacy", "discovery", "verified_recording"] as const;

// The terms and privacy policy a player accepts at sign-up (task 31a). Beta texts until the lawyer's
// (architecture.md, deviation 30): a new version records new consents.
export const TERMS_VERSION = "beta-2026-10-15";
export const PRIVACY_VERSION = "beta-2026-10-15";

// GET /v1/me/consents (task 50c): every consent the player gave, newest first, with when it was revoked.
export const consentHistorySchema = z.object({
  consents: z.array(
    z.object({
      kind: z.enum(CONSENT_KINDS),
      version: z.string(),
      granted_at: z.iso.datetime(),
      revoked_at: z.iso.datetime().nullable(),
    }),
  ),
});

export type ConsentHistory = z.infer<typeof consentHistorySchema>;
