import { notificationsSchema } from "@greenbuild/shared";
import type { NextRequest } from "next/server";
import { invalidBody, proxyToApi } from "../../../../server/api-proxy";

export const dynamic = "force-dynamic";

// Saves the streak reminder and its hour from the settings screen (task 52).
export async function PUT(request: NextRequest): Promise<Response> {
  const body = notificationsSchema.safeParse(await request.json().catch(() => null));
  return body.success ? proxyToApi(request, { method: "PUT", path: "/v1/me/notifications", body: body.data }) : invalidBody();
}
