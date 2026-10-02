import { z } from "zod";

const MIN_SECRET_LENGTH = 32;
const DEFAULT_API_URL = "http://127.0.0.1:3000";

const apiEnvSchema = z.object({
  API_URL: z.url({ protocol: /^https?$/ }).default(DEFAULT_API_URL),
  DEV_AUTH_SECRET: z.string().min(MIN_SECRET_LENGTH).optional(),
});

export interface ApiConfig {
  apiUrl: string;
  // Signs dev sessions until Auth.js login exists; never set in production. Never log it.
  devAuthSecret: string | undefined;
}

export function loadApiConfig(env: Record<string, string | undefined> = process.env): ApiConfig {
  const parsed = apiEnvSchema.parse({ API_URL: env.API_URL || undefined, DEV_AUTH_SECRET: env.DEV_AUTH_SECRET || undefined });
  return {
    apiUrl: parsed.API_URL.replace(/\/$/, ""),
    devAuthSecret: env.NODE_ENV === "production" ? undefined : parsed.DEV_AUTH_SECRET,
  };
}
