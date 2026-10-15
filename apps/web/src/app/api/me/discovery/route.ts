import { discoveryRequestSchema } from "@greenbuild/shared";
import type { NextRequest } from "next/server";
import { invalidBody, proxyToApi } from "../../../../server/api-proxy";

export const dynamic = "force-dynamic";

// Turns company discovery on or off from the settings screen (task 47b); being found needs the 18+ confirmation.
export async function PUT(request: NextRequest): Promise<Response> {
  const body = discoveryRequestSchema.safeParse(await request.json().catch(() => null));
  return body.success ? proxyToApi(request, { method: "PUT", path: "/v1/me/discovery", body: body.data }) : invalidBody();
}
