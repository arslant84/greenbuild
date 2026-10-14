import { cookies } from "next/headers";
import type { z } from "zod";
import { loadApiConfig } from "../config/api";
import { apiBearer } from "./api-bearer";
import { DEV_SESSION_COOKIE } from "./dev-session";
import { logger } from "./logger";

// apiGet reads from the API for a server component as the signed-in user. It returns null when
// there is no session, the API answers an error or the answer does not match the schema.
export async function apiGet<Schema extends z.ZodType>(path: string, schema: Schema): Promise<z.infer<Schema> | null> {
  const token = await apiBearer((await cookies()).get(DEV_SESSION_COOKIE)?.value);
  if (!token) {
    return null;
  }
  return fetchParsed(path, schema, { authorization: `Bearer ${token}` });
}

// apiGetPublic reads a public (@Public()) API route without any session, so the page renders the same
// for every visitor. It returns null when the API answers an error or the answer does not match.
export async function apiGetPublic<Schema extends z.ZodType>(path: string, schema: Schema): Promise<z.infer<Schema> | null> {
  return fetchParsed(path, schema, {});
}

async function fetchParsed<Schema extends z.ZodType>(path: string, schema: Schema, headers: Record<string, string>): Promise<z.infer<Schema> | null> {
  try {
    const response = await fetch(`${loadApiConfig().apiUrl}${path}`, { headers, cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    const parsed = schema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch (error) {
    logger.error("api unreachable", { path, error });
    return null;
  }
}
