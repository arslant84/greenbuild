import { QUEUE_PAYLOAD_FIELD, STREAM_SANDBOX_STATUS } from "@greenbuild/shared";
import { createClient } from "redis";
import type { AttemptsApp, Player } from "./attempts-app.js";

const STATUS_WAIT_MS = 10_000;
const POLL_MS = 100;
export const NGINX_502 = { challenge_slug: "nginx-502-upstream" };

export interface Attempt {
  id: string;
  status: string;
  attach_token?: string;
}

// engineReports publishes on sandbox.status what the engine would.
export async function engineReports(app: () => AttemptsApp, payload: string): Promise<void> {
  const client = createClient({ url: app().env.REDIS_URL });
  await client.connect();
  await client.xAdd(STREAM_SANDBOX_STATUS, "*", { [QUEUE_PAYLOAD_FIELD]: payload });
  await client.close();
}

export function statusMessage(body: object): string {
  return JSON.stringify({ version: 1, ...body });
}

export async function startedBy(user: Player): Promise<Attempt> {
  return (await (await user.start(NGINX_502)).json()) as Attempt;
}

export async function waitForStatus(user: Player, id: string, status: string): Promise<Attempt> {
  const deadline = Date.now() + STATUS_WAIT_MS;
  for (;;) {
    const attempt = (await (await user.find(id)).json()) as Attempt;
    if (attempt.status === status || Date.now() > deadline) {
      return attempt;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

// readyAttempt starts an attempt for user and lets the simulated engine report its sandbox ready.
export async function readyAttempt(app: () => AttemptsApp, user: Player): Promise<string> {
  const { id } = await startedBy(user);
  await engineReports(app, statusMessage({ attempt_id: id, status: "ready", sandbox_id: `sbx-${id}` }));
  await waitForStatus(user, id, "ready");
  return id;
}
