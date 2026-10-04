import type { NextRequest } from "next/server";
import { invalidPath, proxyToApi } from "../../../../../server/api-proxy";
import { attemptPath } from "../attempt-path";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const path = await attemptPath(params, "/abandon");
  return path ? proxyToApi(request, { method: "POST", path }) : invalidPath();
}
