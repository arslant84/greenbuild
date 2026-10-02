import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

// Dev user tokens stand in for Auth.js sessions until login exists (decided 2026-10-02).
export const DEV_USER_AUDIENCE = "greenbuild-dev-user";
export const DEV_USER_TOKEN_LIFETIME = "12h";

const userIdSchema = z.uuid();

export interface AuthenticatedUser {
  id: string;
}

export async function signDevUserToken(secret: string, userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userIdSchema.parse(userId))
    .setAudience(DEV_USER_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(DEV_USER_TOKEN_LIFETIME)
    .sign(new TextEncoder().encode(secret));
}

// verifyDevUserToken returns null for anything but an unexpired HS256 token for DEV_USER_AUDIENCE naming a user.
export async function verifyDevUserToken(secret: string, token: string): Promise<AuthenticatedUser | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
      audience: DEV_USER_AUDIENCE,
      requiredClaims: ["exp", "sub"],
    });
    const userId = userIdSchema.safeParse(payload.sub);
    return userId.success ? { id: userId.data } : null;
  } catch {
    return null;
  }
}
