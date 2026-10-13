import { loadAuthConfig } from "../config/auth";
import { signApiToken } from "./api-token";
import { authInstance } from "./auth";

// apiBearer is the token the web app calls the API with: for a signed-in player, a fresh API token
// (task 30c); otherwise the dev session token, until the dev path goes (task 30e).
export async function apiBearer(devSessionToken: string | undefined): Promise<string | undefined> {
  const session = await authInstance()?.auth();
  const userId = session?.user?.id;
  const config = loadAuthConfig();
  if (userId && config) {
    return signApiToken(config.apiTokenPrivateKey, userId);
  }
  return devSessionToken;
}
