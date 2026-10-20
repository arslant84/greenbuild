import { loadAuthConfig } from "../config/auth";
import { signApiToken } from "./api-token";
import { authInstance } from "./auth";

// apiBearer is the token the web app calls the API with: a fresh API token for the signed-in player
// (task 30c), or none without a session.
export async function apiBearer(): Promise<string | undefined> {
  const session = await authInstance()?.auth();
  const userId = session?.user?.id;
  const config = loadAuthConfig();
  if (!userId || !config) {
    return undefined;
  }
  return signApiToken(config.apiTokenPrivateKey, userId);
}
