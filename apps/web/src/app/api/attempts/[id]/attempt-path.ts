import { z } from "zod";

// attemptPath builds the API path for an attempt, or null for an id that is not a UUID.
export async function attemptPath(params: Promise<{ id: string }>, suffix = ""): Promise<string | null> {
  const id = z.uuid().safeParse((await params).id);
  return id.success ? `/v1/attempts/${id.data}${suffix}` : null;
}
