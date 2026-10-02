import { z } from "zod";

const MIN_SECRET_LENGTH = 32;
const DEFAULT_INTERNAL_URL = "http://127.0.0.1:8080";

const devCheckEnvSchema = z.object({
  GREENBUILD_DEV_CHECK_SECRET: z.string().min(MIN_SECRET_LENGTH).optional(),
  ENGINE_INTERNAL_TOKEN: z.string().min(MIN_SECRET_LENGTH).optional(),
  ENGINE_INTERNAL_URL: z.url({ protocol: /^https?$/ }).default(DEFAULT_INTERNAL_URL),
});

// The dev check route stands in for the API's check endpoint (task 15). Never log these values.
export interface DevCheckConfig {
  ticketSecret: string;
  internalToken: string;
  internalUrl: string;
}

// loadDevCheckConfig returns null, keeping the route off, in production or without both secrets.
export function loadDevCheckConfig(env: Record<string, string | undefined> = process.env): DevCheckConfig | null {
  if (env.NODE_ENV === "production") {
    return null;
  }
  const parsed = devCheckEnvSchema.parse({
    GREENBUILD_DEV_CHECK_SECRET: env.GREENBUILD_DEV_CHECK_SECRET || undefined,
    ENGINE_INTERNAL_TOKEN: env.ENGINE_INTERNAL_TOKEN || undefined,
    ENGINE_INTERNAL_URL: env.ENGINE_INTERNAL_URL || undefined,
  });
  if (!parsed.GREENBUILD_DEV_CHECK_SECRET || !parsed.ENGINE_INTERNAL_TOKEN) {
    return null;
  }
  return {
    ticketSecret: parsed.GREENBUILD_DEV_CHECK_SECRET,
    internalToken: parsed.ENGINE_INTERNAL_TOKEN,
    internalUrl: parsed.ENGINE_INTERNAL_URL,
  };
}
