import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { invalidBody, refusedWrite } from "../../../../server/api-proxy";
import { AGE_COOKIE } from "../../../../server/age-cookie";

export const dynamic = "force-dynamic";

// Long enough for a GitHub round trip; an email link relies on the confirmation recorded for its address.
const AGE_COOKIE_MAX_AGE_SEC = 30 * 60;
const bodySchema = z.object({ confirmed: z.literal(true) });

// The sign-in screen's "I am 16 or older" checkbox (task 30b): remembered in this browser until the
// sign-in it starts creates or completes the account.
export async function POST(request: NextRequest): Promise<Response> {
  const refused = refusedWrite(request);
  if (refused) {
    return refused;
  }
  if (!bodySchema.safeParse(await request.json().catch(() => null)).success) {
    return invalidBody();
  }
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(AGE_COOKIE, "1", {
    httpOnly: true,
    // Lax, so the cookie comes back with GitHub's redirect to the callback.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AGE_COOKIE_MAX_AGE_SEC,
  });
  return response;
}
