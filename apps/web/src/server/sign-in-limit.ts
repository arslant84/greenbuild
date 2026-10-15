import { headers } from "next/headers";
import { createClient } from "redis";
import { LINK_REQUESTS_PER_WINDOW, LINK_WINDOW_SEC } from "./link-limit";
import { rateLimitedPath } from "./sign-in-paths";

// The few Redis commands the limiter needs, so tests can count in memory.
export interface Counter {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number, mode: "NX"): Promise<unknown>;
  ttl(key: string): Promise<number>;
}

// redisCounter connects to Redis on the first link request and keeps the connection.
export function redisCounter(url: string): () => Promise<Counter> {
  let connected: Promise<Counter> | undefined;
  return () => {
    connected ??= createClient({ url }).connect();
    return connected;
  };
}

// linkRequestWait counts a link request against its address and its IP and answers how many seconds to
// wait, or 0 when it may go ahead. It runs before anything looks the address up, so the answer is the
// same whether an account exists or not.
export async function linkRequestWait(counter: Counter, { email, ip }: { email: string; ip: string }): Promise<number> {
  const waits = await Promise.all([count(counter, `sign-in-link:email:${email.toLowerCase()}`), count(counter, `sign-in-link:ip:${ip}`)]);
  return Math.max(...waits);
}

async function count(counter: Counter, key: string): Promise<number> {
  const requests = await counter.incr(key);
  await counter.expire(key, LINK_WINDOW_SEC, "NX");
  if (requests <= LINK_REQUESTS_PER_WINDOW) {
    return 0;
  }
  return Math.max(1, await counter.ttl(key));
}

// linkLimit is the part of Auth.js's signIn callback that stops a link request past the limit: it answers
// the sign-in screen's rate-limited state, or null to go on.
export function linkLimit(counter: () => Promise<Counter>) {
  return async ({ email, verificationRequest }: { email: string; verificationRequest: boolean }): Promise<string | null> => {
    if (!verificationRequest) {
      return null;
    }
    const wait = await linkRequestWait(await counter(), { email, ip: await clientIp() });
    return wait > 0 ? rateLimitedPath(wait) : null;
  };
}

// The client's IP is the last X-Forwarded-For entry: the one Container Apps' ingress appends, which a
// client cannot set. Without a proxy (local runs) every request counts as one unknown IP.
async function clientIp(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",").at(-1)?.trim() || "unknown";
}
