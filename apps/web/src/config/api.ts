import { z } from "zod";

const DEFAULT_API_URL = "http://127.0.0.1:3000";

const apiEnvSchema = z.object({
  API_URL: z.url({ protocol: /^https?$/ }).default(DEFAULT_API_URL),
});

export interface ApiConfig {
  apiUrl: string;
}

export function loadApiConfig(env: Record<string, string | undefined> = process.env): ApiConfig {
  const parsed = apiEnvSchema.parse({ API_URL: env.API_URL || undefined });
  return { apiUrl: parsed.API_URL.replace(/\/$/, "") };
}
