import { AppError, ForbiddenError, UnauthorizedError, UnavailableError, ValidationError } from "@greenbuild/shared";
import type { NextRequest } from "next/server";
import { loadApiConfig } from "../config/api";
import { DEV_SESSION_COOKIE } from "./dev-session";

// Browsers cannot send a custom header cross-site without CORS, so requiring it on writes blocks
// cross-site request forgery until Auth.js brings CSRF tokens.
export const WRITE_HEADER = "x-greenbuild-request";
// The API may wait up to 30 s for the engine's check.
const PROXY_TIMEOUT_MS = 35_000;
const STATUS_BY_CODE = { validation_failed: 400, unauthorized: 401, forbidden: 403, unavailable: 503 } as const;

export interface ProxyOptions {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}

// proxyToApi forwards a page's request to the API as the signed-in user; the token stays on the server.
export async function proxyToApi(request: NextRequest, options: ProxyOptions): Promise<Response> {
  if (options.method !== "GET" && request.headers.get(WRITE_HEADER) !== "1") {
    return failure(new ForbiddenError("Missing request header"));
  }
  const token = request.cookies.get(DEV_SESSION_COOKIE)?.value;
  if (!token) {
    return failure(new UnauthorizedError());
  }
  try {
    const upstream = await fetch(`${loadApiConfig().apiUrl}${options.path}`, {
      method: options.method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });
    return new Response(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("api unreachable", { path: options.path, error: String(error) });
    return failure(new UnavailableError("The service is unavailable"));
  }
}

// invalidPath answers a malformed id or slug before anything reaches the API.
export function invalidPath(): Response {
  return failure(new ValidationError("Invalid path"));
}

function failure(error: AppError): Response {
  const status = STATUS_BY_CODE[error.code as keyof typeof STATUS_BY_CODE];
  return Response.json(error.toResponse(), { status });
}
