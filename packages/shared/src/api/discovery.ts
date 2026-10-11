import { z } from "zod";

// architecture.md, "Кандидат: согласие и приватность" (task 47a): a player is hidden from companies
// until they choose passive or open, and shares only the fields they pick.
export const DISCOVERY_MODES = ["hidden", "passive", "open"] as const;
export const REVEALED_FIELDS = ["name", "email", "github", "linkedin", "website"] as const;
// The version of the discovery terms a player accepts by leaving hidden mode, recorded in consents.
// Change it with the text (owner, after the legal review).
export const DISCOVERY_CONSENT_VERSION = "2026-10-11";

// PUT /v1/me/discovery. Leaving hidden needs the 18+ confirmation once; revealed_fields replaces the set
// when given and keeps it otherwise.
export const discoveryRequestSchema = z.strictObject({
  mode: z.enum(DISCOVERY_MODES),
  confirm_18: z.literal(true).optional(),
  revealed_fields: z
    .array(z.enum(REVEALED_FIELDS))
    .refine((fields) => new Set(fields).size === fields.length, "each field once")
    .optional(),
});

export const discoveryResponseSchema = z.object({
  mode: z.enum(DISCOVERY_MODES),
  revealed_fields: z.array(z.enum(REVEALED_FIELDS)),
  age_confirmed_18: z.boolean(),
});

export type DiscoveryRequest = z.infer<typeof discoveryRequestSchema>;
export type DiscoveryResponse = z.infer<typeof discoveryResponseSchema>;
