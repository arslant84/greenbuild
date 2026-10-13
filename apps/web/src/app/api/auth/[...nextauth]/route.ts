import type { NextRequest } from "next/server";
import { authInstance } from "../../../../server/auth";

export const dynamic = "force-dynamic";

const NOT_FOUND = 404;

// Auth.js answers its own routes (sign-in, callback, session, sign-out) with its CSRF protection;
// without AUTH_SECRET outside production there is no sign-in, so they do not exist.
export function GET(request: NextRequest): Promise<Response> | Response {
  return authInstance()?.handlers.GET(request) ?? new Response(null, { status: NOT_FOUND });
}

export function POST(request: NextRequest): Promise<Response> | Response {
  return authInstance()?.handlers.POST(request) ?? new Response(null, { status: NOT_FOUND });
}
