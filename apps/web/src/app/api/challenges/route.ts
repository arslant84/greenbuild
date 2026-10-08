import type { NextRequest } from "next/server";
import { proxyToApi } from "../../../server/api-proxy";

export const dynamic = "force-dynamic";

// The catalog's "Load more"; the API validates the filters and the cursor.
export async function GET(request: NextRequest): Promise<Response> {
  return proxyToApi(request, {
    method: "GET",
    path: `/v1/challenges${request.nextUrl.search}`,
  });
}
