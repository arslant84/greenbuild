import "reflect-metadata";
import { applyMigrations, connect, isNull, seedChallenges, users } from "@greenbuild/db";
import { API_TOKEN_ALGORITHM, API_TOKEN_AUDIENCE, API_TOKEN_ISSUER, API_TOKEN_LIFETIME_SEC } from "@greenbuild/shared";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { BlobServiceClient } from "@azure/storage-blob";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import postgres from "postgres";
import { createClient } from "redis";
import { afterAll, beforeAll } from "vitest";
import { AppModule } from "../app.module.js";
import type { ServicesEnv } from "../config/services-env.js";
import { type Container, startContainer } from "@greenbuild/testkit";
import { type FakeEngine, startFakeEngine } from "./fake-engine.js";

const STARTUP_TIMEOUT_MS = 180_000;
export const TEST_ATTACH_SECRET = "attach-secret-attach-secret-32byte";
export const TEST_ENGINE_TOKEN = "engine-internal-token-engine-32byte";

export interface AttemptsApp {
  baseUrl: string;
  env: ServicesEnv;
  engine: FakeEngine;
  nest: INestApplication;
  // signApiToken signs what the web app issues for a signed-in user (task 30c).
  signApiToken: (userId: string) => Promise<string>;
}

type ApiTokenSigner = AttemptsApp["signApiToken"];

// apiTokenKeys stands in for the web app's key pair: the API gets the public key, tests sign with the private one.
async function apiTokenKeys(): Promise<{ publicJwk: string; sign: ApiTokenSigner }> {
  const { publicKey, privateKey } = await generateKeyPair(API_TOKEN_ALGORITHM);
  const sign: ApiTokenSigner = (userId) =>
    new SignJWT({})
      .setProtectedHeader({ alg: API_TOKEN_ALGORITHM })
      .setIssuer(API_TOKEN_ISSUER)
      .setAudience(API_TOKEN_AUDIENCE)
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(`${API_TOKEN_LIFETIME_SEC}s`)
      .sign(privateKey);
  return { publicJwk: JSON.stringify(await exportJWK(publicKey)), sign };
}

async function startPostgres(): Promise<Container> {
  return startContainer({
    image: "postgres:16-alpine",
    port: 5432,
    env: { POSTGRES_PASSWORD: "test" },
    ready: async (address) => {
      const sql = postgres(`postgres://postgres:test@${address}/postgres`, { max: 1, onnotice: () => undefined });
      try {
        await sql`select 1`;
      } finally {
        await sql.end();
      }
    },
  });
}

// Azurite's documented development account, for the data export archives (task 50a).
const AZURITE_ACCOUNT = "devstoreaccount1";
const AZURITE_KEY = "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";

export function azuriteConnection(address: string): string {
  return `DefaultEndpointsProtocol=http;AccountName=${AZURITE_ACCOUNT};AccountKey=${AZURITE_KEY};BlobEndpoint=http://${address}/${AZURITE_ACCOUNT};`;
}

async function startAzurite(): Promise<Container> {
  return startContainer({
    image: "mcr.microsoft.com/azure-storage/azurite",
    port: 10000,
    args: ["azurite-blob", "--blobHost", "0.0.0.0", "--skipApiVersionCheck"],
    ready: async (address) => {
      await BlobServiceClient.fromConnectionString(azuriteConnection(address)).listContainers().next();
    },
  });
}

async function startRedis(): Promise<Container> {
  return startContainer({
    image: "redis:8-alpine",
    port: 6379,
    ready: async (address) => {
      const client = createClient({ url: `redis://${address}` });
      client.on("error", () => undefined);
      await client.connect();
      await client.close();
    },
  });
}

// useAttemptsApp runs the API with its real services: migrated and seeded PostgreSQL 16, and Redis;
// with exportArchives also Azurite, where data export archives are read from (task 50a).
export function useAttemptsApp(options: { exportArchives?: boolean } = {}): () => AttemptsApp {
  const started: { app?: INestApplication; containers: Container[]; engine?: FakeEngine; ready?: AttemptsApp } = { containers: [] };
  beforeAll(async () => {
    const [database, redis, azurite] = await Promise.all([startPostgres(), startRedis(), ...(options.exportArchives ? [startAzurite()] : [])]);
    started.containers.push(...[database, redis, azurite].filter((container) => container !== undefined));
    const engine = await startFakeEngine();
    started.engine = engine;
    const apiToken = await apiTokenKeys();
    const env: ServicesEnv = {
      NODE_ENV: "test",
      DATABASE_URL: `postgres://postgres:test@${database.address}/postgres`,
      REDIS_URL: `redis://${redis.address}`,
      ATTACH_SECRET: TEST_ATTACH_SECRET,
      ENGINE_INTERNAL_URL: engine.url,
      ENGINE_INTERNAL_TOKEN: TEST_ENGINE_TOKEN,
      API_TOKEN_PUBLIC_KEY: apiToken.publicJwk,
      ...(azurite ? { EXPORT_BLOB_CONNECTION_STRING: azuriteConnection(azurite.address) } : {}),
    };
    await applyMigrations(env.DATABASE_URL);
    const seeding = connect(env.DATABASE_URL);
    await seedChallenges(seeding.db);
    await seeding.close();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] }).compile();
    started.app = moduleRef.createNestApplication({ logger: false });
    await started.app.listen(0);
    started.ready = { baseUrl: await started.app.getUrl(), env, engine, nest: started.app, signApiToken: apiToken.sign };
  }, STARTUP_TIMEOUT_MS);
  afterAll(async () => {
    await started.app?.close();
    await started.engine?.close();
    await Promise.all(started.containers.map((container) => container.stop()));
  });
  return () => {
    if (!started.ready) {
      throw new Error("attempts app not started");
    }
    return started.ready;
  };
}

export interface Player {
  userId: string;
  start: (body: unknown) => Promise<Response>;
  find: (id: string) => Promise<Response>;
  list: (query: string) => Promise<Response>;
  check: (id: string) => Promise<Response>;
  abandon: (id: string) => Promise<Response>;
  hint: (id: string) => Promise<Response>;
  result: (id: string) => Promise<Response>;
  card: (slug: string) => Promise<Response>;
  catalog: (query: string) => Promise<Response>;
}

// playerToken signs an API token for a player, first creating their user as sign-in does (task 30a),
// confirmed 16+ (task 30b), or confirming one a test created; the API admits no token for a user that
// does not exist, nor one without the 16+ date.
export async function playerToken(app: () => AttemptsApp, userId: string): Promise<string> {
  const connection = connect(app().env.DATABASE_URL);
  try {
    await connection.db
      .insert(users)
      .values({ id: userId, ageConfirmed16At: new Date() })
      .onConflictDoUpdate({ target: users.id, set: { ageConfirmed16At: new Date() }, setWhere: isNull(users.ageConfirmed16At) });
  } finally {
    await connection.close();
  }
  return app().signApiToken(userId);
}

// player calls the API as one signed-in player.
export async function player(app: () => AttemptsApp, userId: string): Promise<Player> {
  const token = await playerToken(app, userId);
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  return {
    userId,
    start: (body) => fetch(`${app().baseUrl}/v1/attempts`, { method: "POST", headers, body: JSON.stringify(body) }),
    find: (id) => fetch(`${app().baseUrl}/v1/attempts/${id}`, { headers }),
    list: (query) => fetch(`${app().baseUrl}/v1/attempts${query}`, { headers }),
    check: (id) => fetch(`${app().baseUrl}/v1/attempts/${id}/check`, { method: "POST", headers }),
    abandon: (id) => fetch(`${app().baseUrl}/v1/attempts/${id}/abandon`, { method: "POST", headers }),
    hint: (id) => fetch(`${app().baseUrl}/v1/attempts/${id}/hint`, { method: "POST", headers }),
    result: (id) => fetch(`${app().baseUrl}/v1/attempts/${id}/result`, { headers }),
    card: (slug) => fetch(`${app().baseUrl}/v1/challenges/${slug}`, { headers }),
    catalog: (query) => fetch(`${app().baseUrl}/v1/challenges${query}`, { headers }),
  };
}
