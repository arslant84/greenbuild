import { Inject, Injectable } from "@nestjs/common";
import { SignJWT } from "jose";
import type { ServicesEnv } from "../config/services-env.js";
import { SERVICES_ENV } from "../infra/services.js";

// Must match apps/sandbox-engine/internal/attachtoken: audience and the 60-second maximum lifetime.
const ATTACH_AUDIENCE = "sandbox-attach";
const ATTACH_TOKEN_LIFETIME = "60s";

export interface AttachGrant {
  sandboxId: string;
  attemptId: string;
  userId: string;
}

// AttachTokens issues the token a browser uses to open the sandbox terminal (architecture.md:
// JWT, 60 seconds to connect, bound to the attempt and the user).
@Injectable()
export class AttachTokens {
  private readonly secret: Uint8Array;

  constructor(@Inject(SERVICES_ENV) env: ServicesEnv) {
    this.secret = new TextEncoder().encode(env.ATTACH_SECRET);
  }

  sign(grant: AttachGrant): Promise<string> {
    return new SignJWT({ sandbox_id: grant.sandboxId, attempt_id: grant.attemptId })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(grant.userId)
      .setAudience(ATTACH_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(ATTACH_TOKEN_LIFETIME)
      .sign(this.secret);
  }
}
