import { type NextRequest, NextResponse } from "next/server";
import { authInstance } from "./server/auth";
import { SIGN_IN_PATH } from "./server/sign-in-paths";

// The play screens, the catalog, the leaderboard and the settings need a signed-in player (task 30e): a
// visitor without a session goes to the sign-in screen, which brings them back after. Without sign-in
// configured (a local run without the stack) nothing is redirected.
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const auth = authInstance();
  if (!auth || (await auth.auth())?.user) {
    return NextResponse.next();
  }
  const signIn = new URL(SIGN_IN_PATH, request.url);
  signIn.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(signIn);
}

export const config = { matcher: ["/play", "/play/:path*", "/challenges", "/leaderboard", "/settings"] };
