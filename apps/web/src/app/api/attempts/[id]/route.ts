import type { NextRequest } from "next/server";
import { invalidPath, proxyToApi } from "../../../../server/api-proxy";
import { attemptPath } from "./attempt-path";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const path = await attemptPath(params);
  return path ? proxyToApi(request, { method: "GET", path }) : invalidPath();
}
