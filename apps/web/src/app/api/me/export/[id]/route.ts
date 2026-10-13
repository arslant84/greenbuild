import type { NextRequest } from "next/server";
import { z } from "zod";
import { invalidPath, proxyToApi } from "../../../../../server/api-proxy";

export const dynamic = "force-dynamic";

// The emailed link (task 50a): the archive downloads as a file for its signed-in owner.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const id = z.uuid().safeParse((await params).id);
  return id.success ? proxyToApi(request, { method: "GET", path: `/v1/me/export/${id.data}` }) : invalidPath();
}
