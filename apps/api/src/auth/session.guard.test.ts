import "reflect-metadata";
import { API_TOKEN_ALGORITHM, API_TOKEN_AUDIENCE, API_TOKEN_ISSUER } from "@greenbuild/shared";
import { Controller, Get, type INestApplication, UseGuards } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ServicesEnv } from "../config/services-env.js";
import { AppErrorFilter } from "../errors/app-error.filter.js";
import { SERVICES_ENV } from "../infra/services.js";
import type { AuthenticatedUser } from "./api-token.js";
import { CurrentUser, SessionGuard } from "./session.guard.js";

const USER_ID = "0199a5c4-7b2e-7c3a-9f10-2b3c4d5e6f70";
// Each test boots a NestJS app; the first one pays the cold start, which can pass vitest's 5 s
// default while other suites start their containers in a full run.
const NEST_BOOT_TIMEOUT_MS = 20_000;

type SigningKey = Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

@Controller("whoami")
@UseGuards(SessionGuard)
class WhoAmIController {
  @Get()
  whoAmI(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}

let app: INestApplication | undefined;
// The web app's key pair, and another the API does not know.
let webKey: SigningKey;
let otherKey: SigningKey;
let webPublicJwk: string;

async function serve(env: Partial<ServicesEnv>): Promise<string> {
  const moduleRef = await Test.createTestingModule({
    controllers: [WhoAmIController],
    providers: [{ provide: SERVICES_ENV, useValue: env }, { provide: APP_FILTER, useClass: AppErrorFilter }, SessionGuard],
  }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.listen(0);
  return `${await app.getUrl()}/whoami`;
}

function call(url: string, token?: string): Promise<Response> {
  return fetch(url, token ? { headers: { authorization: `Bearer ${token}` } } : {});
}

function apiToken(claims: { aud?: string; sub?: string }, key = webKey): Promise<string> {
  const jwt = new SignJWT({}).setProtectedHeader({ alg: API_TOKEN_ALGORITHM }).setIssuer(API_TOKEN_ISSUER).setIssuedAt().setExpirationTime("1m");
  if (claims.aud) jwt.setAudience(claims.aud);
  if (claims.sub) jwt.setSubject(claims.sub);
  return jwt.sign(key);
}

beforeAll(async () => {
  const web = await generateKeyPair(API_TOKEN_ALGORITHM);
  webKey = web.privateKey;
  webPublicJwk = JSON.stringify(await exportJWK(web.publicKey));
  otherKey = (await generateKeyPair(API_TOKEN_ALGORITHM)).privateKey;
});

afterEach(async () => {
  await app?.close();
});

describe("SessionGuard", { timeout: NEST_BOOT_TIMEOUT_MS }, () => {
  it("admits the web app's API token and passes the player on", async () => {
    const url = await serve({ API_TOKEN_PUBLIC_KEY: webPublicJwk });
    const response = await call(url, await apiToken({ aud: API_TOKEN_AUDIENCE, sub: USER_ID }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: USER_ID });
  });

  it.each([
    ["no token", () => Promise.resolve(undefined)],
    ["a token signed with another key", () => apiToken({ aud: API_TOKEN_AUDIENCE, sub: USER_ID }, otherKey)],
    ["another audience", () => apiToken({ aud: "sandbox-attach", sub: USER_ID })],
    ["a subject that is not a user id", () => apiToken({ aud: API_TOKEN_AUDIENCE, sub: "admin" })],
    ["no subject", () => apiToken({ aud: API_TOKEN_AUDIENCE })],
  ])("refuses %s with the shared error format", async (_name, token) => {
    const url = await serve({ API_TOKEN_PUBLIC_KEY: webPublicJwk });
    const response = await call(url, await token());

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthorized" });
  });

  it("admits nobody without the web app's key", async () => {
    const url = await serve({});

    expect((await call(url, await apiToken({ aud: API_TOKEN_AUDIENCE, sub: USER_ID }))).status).toBe(401);
  });
});
