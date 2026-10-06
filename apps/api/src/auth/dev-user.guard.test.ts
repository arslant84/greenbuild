import "reflect-metadata";
import { Controller, Get, type INestApplication, UseGuards } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { SignJWT } from "jose";
import { afterEach, describe, expect, it } from "vitest";
import type { ServicesEnv } from "../config/services-env.js";
import { AppErrorFilter } from "../errors/app-error.filter.js";
import { SERVICES_ENV } from "../infra/services.js";
import { type AuthenticatedUser, DEV_USER_AUDIENCE, signDevUserToken } from "./dev-user-token.js";
import { CurrentUser, DevUserGuard } from "./dev-user.guard.js";

const SECRET = "dev-auth-secret-dev-auth-secret-32";
const USER_ID = "0199a5c4-7b2e-7c3a-9f10-2b3c4d5e6f70";
// Each test boots a NestJS app; the first one pays the cold start, which can pass vitest's 5 s
// default while other suites start their containers in a full run.
const NEST_BOOT_TIMEOUT_MS = 20_000;

@Controller("whoami")
@UseGuards(DevUserGuard)
class WhoAmIController {
  @Get()
  whoAmI(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}

let app: INestApplication | undefined;

async function serve(env: Partial<ServicesEnv>): Promise<string> {
  const moduleRef = await Test.createTestingModule({
    controllers: [WhoAmIController],
    providers: [{ provide: SERVICES_ENV, useValue: env }, { provide: APP_FILTER, useClass: AppErrorFilter }, DevUserGuard],
  }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.listen(0);
  return `${await app.getUrl()}/whoami`;
}

function call(url: string, token?: string): Promise<Response> {
  return fetch(url, token ? { headers: { authorization: `Bearer ${token}` } } : {});
}

function forged(claims: { aud?: string; sub?: string }, secret = SECRET): Promise<string> {
  const jwt = new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h");
  if (claims.aud) jwt.setAudience(claims.aud);
  if (claims.sub) jwt.setSubject(claims.sub);
  return jwt.sign(new TextEncoder().encode(secret));
}

afterEach(async () => {
  await app?.close();
});

describe("DevUserGuard", { timeout: NEST_BOOT_TIMEOUT_MS }, () => {
  it("admits a dev user token and passes the user on", async () => {
    const url = await serve({ NODE_ENV: "development", DEV_AUTH_SECRET: SECRET });
    const response = await call(url, await signDevUserToken(SECRET, USER_ID));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: USER_ID });
  });

  it.each([
    ["no token", () => Promise.resolve(undefined)],
    ["another secret", () => forged({ aud: DEV_USER_AUDIENCE, sub: USER_ID }, "another-secret-another-secret-123")],
    ["another audience", () => forged({ aud: "sandbox-attach", sub: USER_ID })],
    ["a subject that is not a user id", () => forged({ aud: DEV_USER_AUDIENCE, sub: "admin" })],
    ["no subject", () => forged({ aud: DEV_USER_AUDIENCE })],
  ])("refuses %s with the shared error format", async (_name, token) => {
    const url = await serve({ NODE_ENV: "development", DEV_AUTH_SECRET: SECRET });
    const response = await call(url, await token());

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthorized" });
  });

  it.each([
    ["in production", { NODE_ENV: "production" as const, DEV_AUTH_SECRET: SECRET }],
    ["without DEV_AUTH_SECRET", { NODE_ENV: "development" as const }],
  ])("admits nobody %s", async (_name, env) => {
    const url = await serve(env);

    expect((await call(url, await signDevUserToken(SECRET, USER_ID))).status).toBe(401);
  });
});
