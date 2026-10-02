import { randomUUID } from "node:crypto";
import { NotFoundError } from "@greenbuild/shared";
import { type NextRequest, NextResponse } from "next/server";
import { loadApiConfig } from "../../../config/api";
import { DEV_SESSION_COOKIE, DEV_SESSION_MAX_AGE_SEC, signDevSession } from "../../../server/dev-session";

const HTTP_NOT_FOUND = 404;
const HTTP_SEE_OTHER = 303;

export const dynamic = "force-dynamic";

// POST /dev/sign-in starts a session as a new dev user and returns to the daily challenge.
// It does not exist in production or without DEV_AUTH_SECRET.
export async function POST(request: NextRequest): Promise<Response> {
  const { devAuthSecret } = loadApiConfig();
  if (!devAuthSecret) {
    return Response.json(new NotFoundError("Not found").toResponse(), { status: HTTP_NOT_FOUND });
  }
  const response = NextResponse.redirect(new URL("/play", request.url), HTTP_SEE_OTHER);
  response.cookies.set(DEV_SESSION_COOKIE, await signDevSession(devAuthSecret, randomUUID()), {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: DEV_SESSION_MAX_AGE_SEC,
  });
  return response;
}
