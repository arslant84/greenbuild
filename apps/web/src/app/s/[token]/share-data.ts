import { type ShareCard, shareCardSchema, shareTokenSchema } from "@greenbuild/shared";
import { apiGetPublic } from "../../../server/api";

// loadShareCard reads a share card for any visitor (task 51); a malformed, unknown or revoked token is null.
export async function loadShareCard(token: string): Promise<ShareCard | null> {
  if (!shareTokenSchema.safeParse(token).success) {
    return null;
  }
  return apiGetPublic(`/v1/share/${token}`, shareCardSchema);
}
