import { type NextRequest, NextResponse } from "next/server";
import { loadApiConfig } from "./config/api";
import { DEV_SESSION_COOKIE, DEV_SESSION_MAX_AGE_SEC, signDevSession } from "./server/dev-session";

// Until Auth.js login exists, a visit to the play screens, the catalog, the leaderboard or the settings without a session starts one as a new
// dev user. Nothing happens in production or without DEV_AUTH_SECRET.
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { devAuthSecret } = loadApiConfig();
  if (!devAuthSecret || request.cookies.has(DEV_SESSION_COOKIE)) {
    return NextResponse.next();
  }
  const token = await signDevSession(devAuthSecret, crypto.randomUUID());
  // Server components rendering this same request read the session from its headers.
  request.cookies.set(DEV_SESSION_COOKIE, token);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(DEV_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: DEV_SESSION_MAX_AGE_SEC,
  });
  return response;
}

export const config = { matcher: ["/play", "/play/:path*", "/challenges", "/leaderboard", "/settings"] };
