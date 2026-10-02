import type { NextRequest } from "next/server";
import { proxyToApi } from "../../../server/api-proxy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  return proxyToApi(request, { method: "POST", path: "/v1/attempts", body });
}
