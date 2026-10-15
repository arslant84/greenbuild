import { AGE_NOT_CONFIRMED } from "@greenbuild/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { loadApiConfig } from "../config/api";
import { apiBearer } from "./api-bearer";
import { DEV_SESSION_COOKIE } from "./dev-session";
import { logger } from "./logger";
import { AGE_REQUIRED_PATH } from "./sign-in-paths";

const ageNotConfirmedSchema = z.object({ details: z.object({ reason: z.literal(AGE_NOT_CONFIRMED) }) });

// apiGet reads from the API for a server component as the signed-in user. It returns null when
// there is no session, the API answers an error or the answer does not match the schema. A player
// who has not confirmed being 16 or older goes to the sign-in screen to confirm it (task 30b).
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
  const response = await fetchApi(path, headers);
  if (!response) {
    return null;
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    // Outside any try: redirect works by throwing.
    if (response.status === 403 && ageNotConfirmedSchema.safeParse(body).success) {
      redirect(AGE_REQUIRED_PATH);
    }
    return null;
  }
  const parsed = schema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

async function fetchApi(path: string, headers: Record<string, string>): Promise<Response | null> {
  try {
    return await fetch(`${loadApiConfig().apiUrl}${path}`, { headers, cache: "no-store" });
  } catch (error) {
    logger.error("api unreachable", { path, error });
    return null;
  }
}
