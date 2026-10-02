import { randomUUID } from "node:crypto";
import { signDevUserToken } from "../auth/dev-user-token.js";

// Prints a dev user token for the API: pnpm --filter @greenbuild/api dev:user-token [user-uuid]
const secret = process.env.DEV_AUTH_SECRET ?? "";
if (secret.length < 32) {
  console.error("DEV_AUTH_SECRET must be set (at least 32 characters), the same value the API uses");
  process.exit(1);
}
const userId = process.argv[2] ?? randomUUID();
console.error(`user ${userId}`);
console.log(await signDevUserToken(secret, userId));
