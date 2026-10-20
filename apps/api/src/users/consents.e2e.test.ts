import { randomUUID } from "node:crypto";
import { DISCOVERY_CONSENT_VERSION } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { playerToken, useAttemptsApp } from "../testing/attempts-app.js";

// architecture.md, task 50c: GET /v1/me/consents shows every consent, newest first, revoked ones too.
const app = useAttemptsApp();

async function headers(userId: string): Promise<Record<string, string>> {
  return { authorization: `Bearer ${await playerToken(app, userId)}`, "content-type": "application/json" };
}

async function consentsOf(userId: string): Promise<Response> {
  return fetch(`${app().baseUrl}/v1/me/consents`, { headers: await headers(userId) });
}

async function discovery(userId: string, body: unknown): Promise<void> {
  await fetch(`${app().baseUrl}/v1/me/discovery`, { method: "PUT", headers: await headers(userId), body: JSON.stringify(body) });
}

describe("GET /v1/me/consents", () => {
  it("is empty for a new player", async () => {
    expect(await (await consentsOf(randomUUID())).json()).toEqual({ consents: [] });
  });

  it("lists a revoked discovery consent after the newer one", async () => {
    const userId = randomUUID();
    await discovery(userId, { mode: "open", confirm_18: true });
    await discovery(userId, { mode: "hidden" });
    await discovery(userId, { mode: "passive" });

    const { consents } = (await (await consentsOf(userId)).json()) as { consents: { kind: string; version: string; revoked_at: string | null }[] };
    expect(consents.map(({ kind, version, revoked_at }) => [kind, version, revoked_at === null])).toEqual([
      ["discovery", DISCOVERY_CONSENT_VERSION, true],
      ["discovery", DISCOVERY_CONSENT_VERSION, false],
    ]);
  });
});
