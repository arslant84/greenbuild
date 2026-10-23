import { type ShareCard, shareCardSchema, shareTokenSchema } from "@greenbuild/shared";
import { headers } from "next/headers";
import { apiGetPublic } from "../../../server/api";

// loadShareCard reads a share card for any visitor (task 51); a malformed, unknown or revoked token is null.
export async function loadShareCard(token: string): Promise<ShareCard | null> {
  if (!shareTokenSchema.safeParse(token).success) {
    return null;
  }
  return apiGetPublic(`/v1/share/${token}`, shareCardSchema);
}

// requestOrigin is the address the visitor used, so link previews get an absolute image URL behind any proxy.
export async function requestOrigin(): Promise<string> {
  const request = await headers();
  const host = request.get("x-forwarded-host") ?? request.get("host") ?? "localhost";
  const protocol = request.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${protocol}://${host}`;
}
