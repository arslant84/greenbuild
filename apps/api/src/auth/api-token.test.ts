import { randomUUID } from "node:crypto";
import { API_TOKEN_AUDIENCE, API_TOKEN_ISSUER } from "@greenbuild/shared";
import { exportJWK, generateKeyPair, type JWTPayload, SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { apiTokenKey, verifyApiToken } from "./api-token.js";

// architecture.md, task 30c: the API admits only ES256 tokens the web app signed for it, for 5 minutes.
type SigningKey = Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
const NOW_SEC = Math.floor(Date.now() / 1000);
const SIX_MINUTES_SEC = 6 * 60;

let privateKey: SigningKey;
let otherPrivateKey: SigningKey;
let publicJwk: string;

beforeAll(async () => {
  const pair = await generateKeyPair("ES256");
  privateKey = pair.privateKey;
  publicJwk = JSON.stringify(await exportJWK(pair.publicKey));
  otherPrivateKey = (await generateKeyPair("ES256")).privateKey;
});

function token(claims: JWTPayload, key: SigningKey = privateKey): Promise<string> {
  return new SignJWT(claims).setProtectedHeader({ alg: "ES256" }).sign(key);
}

function claims(overrides: JWTPayload = {}): JWTPayload {
  return { iss: API_TOKEN_ISSUER, aud: API_TOKEN_AUDIENCE, sub: randomUUID(), iat: NOW_SEC, exp: NOW_SEC + 300, ...overrides };
}

describe("verifyApiToken", () => {
  it("admits a token the web app signed for this API, naming its user", async () => {
    const userId = randomUUID();

    expect(await verifyApiToken(await apiTokenKey(publicJwk), await token(claims({ sub: userId })))).toEqual({ id: userId });
  });

  it.each([
    ["another key", () => token(claims(), otherPrivateKey)],
    ["another audience", () => token(claims({ aud: "greenbuild-dev-user" }))],
    ["another issuer", () => token(claims({ iss: "someone-else" }))],
    ["an expired token", () => token(claims({ iat: NOW_SEC - SIX_MINUTES_SEC, exp: NOW_SEC - 60 }))],
    ["a token issued over 5 minutes ago", () => token(claims({ iat: NOW_SEC - SIX_MINUTES_SEC, exp: NOW_SEC + 300 }))],
    ["a subject that is not a user id", () => token(claims({ sub: "admin" }))],
    ["an HS256 token", () => new SignJWT(claims()).setProtectedHeader({ alg: "HS256" }).sign(new TextEncoder().encode("s".repeat(32)))],
  ])("refuses %s", async (_case, makeToken) => {
    expect(await verifyApiToken(await apiTokenKey(publicJwk), await makeToken())).toBeNull();
  });
});
