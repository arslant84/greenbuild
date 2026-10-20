import { unsubscribeRequestSchema } from "@greenbuild/shared";
import type { NextRequest } from "next/server";
import { loadApiConfig } from "../../../../config/api";
import { invalidBody } from "../../../../server/api-proxy";
import { logger } from "../../../../server/logger";

export const dynamic = "force-dynamic";

// The one-click unsubscribe of the reminder emails (task 52; RFC 8058): mail providers POST to the URL in
// List-Unsubscribe, with the player's token in it, no session and no write header. The token is random
// and only turns reminders off, so a forged request can do no more than that.
export async function POST(request: NextRequest): Promise<Response> {
  const body = unsubscribeRequestSchema.safeParse({ token: request.nextUrl.searchParams.get("token") });
  if (!body.success) {
    return invalidBody();
  }
  const answer = await fetch(`${loadApiConfig().apiUrl}/v1/notifications/unsubscribe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body.data),
  }).catch((error: unknown) => {
    logger.error("api unreachable", { path: "/v1/notifications/unsubscribe", error });
    return null;
  });
  return new Response(null, { status: answer?.ok ? 204 : 503 });
}
