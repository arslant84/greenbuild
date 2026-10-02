import "reflect-metadata";
import { applyMigrations, connect, seedChallenges } from "@greenbuild/db";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import postgres from "postgres";
import { createClient } from "redis";
import { afterAll, beforeAll } from "vitest";
import { AppModule } from "../app.module.js";
import type { ServicesEnv } from "../config/services-env.js";
import { type Container, startContainer } from "./containers.js";

const STARTUP_TIMEOUT_MS = 180_000;
export const TEST_DEV_AUTH_SECRET = "dev-auth-secret-dev-auth-secret-32";
export const TEST_ATTACH_SECRET = "attach-secret-attach-secret-32byte";

export interface AttemptsApp {
  baseUrl: string;
  env: ServicesEnv;
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

// useAttemptsApp runs the API with its real services: migrated and seeded PostgreSQL 16, and Redis.
export function useAttemptsApp(): () => AttemptsApp {
  const started: { app?: INestApplication; containers: Container[]; ready?: AttemptsApp } = { containers: [] };
  beforeAll(async () => {
    const [database, redis] = await Promise.all([startPostgres(), startRedis()]);
    started.containers.push(database, redis);
    const env: ServicesEnv = {
      NODE_ENV: "test",
      DATABASE_URL: `postgres://postgres:test@${database.address}/postgres`,
      REDIS_URL: `redis://${redis.address}`,
      ATTACH_SECRET: TEST_ATTACH_SECRET,
      DEV_AUTH_SECRET: TEST_DEV_AUTH_SECRET,
    };
    await applyMigrations(env.DATABASE_URL);
    const seeding = connect(env.DATABASE_URL);
    await seedChallenges(seeding.db);
    await seeding.close();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] }).compile();
    started.app = moduleRef.createNestApplication({ logger: false });
    await started.app.listen(0);
    started.ready = { baseUrl: await started.app.getUrl(), env };
  }, STARTUP_TIMEOUT_MS);
  afterAll(async () => {
    await started.app?.close();
    await Promise.all(started.containers.map((container) => container.stop()));
  });
  return () => {
    if (!started.ready) {
      throw new Error("attempts app not started");
    }
    return started.ready;
  };
}
