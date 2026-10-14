import { updateMeRequestSchema } from "@greenbuild/shared";
import type { NextRequest } from "next/server";
import { invalidBody, proxyToApi } from "../../../server/api-proxy";

export const dynamic = "force-dynamic";

// Changes the player's own profile from the settings screen (task 47b): handle, display name, timezone.
export async function PATCH(request: NextRequest): Promise<Response> {
  const body = updateMeRequestSchema.safeParse(await request.json().catch(() => null));
  return body.success ? proxyToApi(request, { method: "PATCH", path: "/v1/me", body: body.data }) : invalidBody();
}

// Deletes the player's account from the settings screen (task 47b): hidden at once, personal data gone later.
export function DELETE(request: NextRequest): Promise<Response> {
  return proxyToApi(request, { method: "DELETE", path: "/v1/me" });
}
