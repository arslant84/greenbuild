import { appIcon } from "../app-icon";
import { APP_ICON_SIZES } from "../sizes";

// GET /app-icon/{192,512}: the manifest's icons (task 56).
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }): Promise<Response> {
  const size = Number((await params).size);
  return APP_ICON_SIZES.some((allowed) => allowed === size) ? appIcon(size) : new Response("Not found", { status: 404 });
}
