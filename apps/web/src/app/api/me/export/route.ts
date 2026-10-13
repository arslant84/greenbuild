import type { NextRequest } from "next/server";
import { proxyToApi } from "../../../../server/api-proxy";

export const dynamic = "force-dynamic";

// Asks for the player's data export (task 50a); the archive arrives by email as a link.
export function POST(request: NextRequest): Promise<Response> {
  return proxyToApi(request, { method: "POST", path: "/v1/me/export" });
}
