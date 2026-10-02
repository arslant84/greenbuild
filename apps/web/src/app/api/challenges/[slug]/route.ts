import type { NextRequest } from "next/server";
import { invalidPath, proxyToApi } from "../../../../server/api-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await params;
  return /^[a-z0-9-]{1,64}$/.test(slug) ? proxyToApi(request, { method: "GET", path: `/v1/challenges/${slug}` }) : invalidPath();
}
