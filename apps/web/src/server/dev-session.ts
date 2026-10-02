import { SignJWT } from "jose";

// The dev session cookie holds a dev user token for the API (apps/api DevUserGuard) until Auth.js
// login exists. httpOnly, so page scripts never see it.
export const DEV_SESSION_COOKIE = "gb_dev_session";
export const DEV_SESSION_MAX_AGE_SEC = 12 * 60 * 60;
const DEV_USER_AUDIENCE = "greenbuild-dev-user";

export function signDevSession(secret: string, userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience(DEV_USER_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${DEV_SESSION_MAX_AGE_SEC}s`)
    .sign(new TextEncoder().encode(secret));
}
