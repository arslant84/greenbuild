import type { NextRequest } from "next/server";
import { invalidPath, proxyToApi } from "../../../../../server/api-proxy";
import { attemptPath } from "../attempt-path";

export const dynamic = "force-dynamic";

// Makes the solved attempt's share link (task 51).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const path = await attemptPath(params, "/share");
  return path ? proxyToApi(request, { method: "POST", path }) : invalidPath();
}

// Revokes it.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const path = await attemptPath(params, "/share");
  return path ? proxyToApi(request, { method: "DELETE", path }) : invalidPath();
}
