import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// Must match ticketAudience in apps/sandbox-engine/cmd/dev-attempt.
const TICKET_AUDIENCE = "dev-check";
const MS_PER_SECOND = 1000;

const headerSchema = z.object({ alg: z.literal("HS256") });
const claimsSchema = z.object({
  aud: z.union([z.string(), z.array(z.string())]),
  exp: z.number(),
  attempt_id: z.string().min(1),
  sandbox_id: z.string().min(1),
  challenge_id: z.string().regex(/^[a-z0-9-]+$/),
});

// A ticket lets its holder check one attempt's sandbox against one challenge.
export interface Ticket {
  attemptId: string;
  sandboxId: string;
  challengeId: string;
}

// verifyTicket accepts only an unexpired HS256 token for TICKET_AUDIENCE; anything else is null.
export function verifyTicket(token: string, secret: string, nowMs: number): Ticket | null {
  const [header, payload, signature, ...rest] = token.split(".");
  if (header === undefined || payload === undefined || signature === undefined || rest.length > 0) {
    return null;
  }
  if (!signatureMatches(`${header}.${payload}`, signature, secret) || !headerSchema.safeParse(decode(header)).success) {
    return null;
  }
  const claims = claimsSchema.safeParse(decode(payload));
  if (!claims.success || !forTickets(claims.data.aud) || claims.data.exp * MS_PER_SECOND <= nowMs) {
    return null;
  }
  return { attemptId: claims.data.attempt_id, sandboxId: claims.data.sandbox_id, challengeId: claims.data.challenge_id };
}

function signatureMatches(signed: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(signed).digest();
  const given = Buffer.from(signature, "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function forTickets(audience: string | string[]): boolean {
  return Array.isArray(audience) ? audience.includes(TICKET_AUDIENCE) : audience === TICKET_AUDIENCE;
}

function decode(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}
