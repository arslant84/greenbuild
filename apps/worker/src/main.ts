import type { Server } from "node:http";
import { connect } from "@greenbuild/db";
import { createClient } from "redis";
import { type Env, loadEnv } from "./config/env.js";
import { runDailyPublisher } from "./daily/schedule.js";
import { createHealthServer } from "./health/health-server.js";
import { logger } from "./logger.js";
import { runRelay } from "./outbox/relay.js";
import { type FinishedHandler, runFinishedConsumer } from "./finished-consumer.js";
import { ratingHandler } from "./rating/rate.js";
import { xpHandler } from "./xp/credit.js";

const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM"] as const;

type Stop = () => Promise<void>;

async function main(): Promise<void> {
  const env = loadEnv(process.env);
  const server = createHealthServer();
  const stops = [await startRelay(env), startDailyPublisher(env), await startFinishedConsumer(env, xpHandler), await startFinishedConsumer(env, ratingHandler)];

  server.listen(env.PORT, () => {
    logger.info("worker listening", { port: env.PORT });
  });

  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, () => void shutdown(server, stops));
  }
}

// startRelay publishes outbox events when the worker has a database and Redis; the returned stop
// ends the loop and closes both.
async function startRelay(env: Env): Promise<Stop> {
  if (!env.DATABASE_URL || !env.REDIS_URL) {
    logger.warn("outbox relay disabled; set DATABASE_URL and REDIS_URL to publish events");
    return async () => undefined;
  }
  const database = connect(env.DATABASE_URL);
  const redis = createClient({ url: env.REDIS_URL });
  // Without a listener a dropped connection would crash the process; the relay retries instead.
  redis.on("error", (error: unknown) => logger.error("redis connection error", { error }));
  await redis.connect();
  const controller = new AbortController();
  const running = runRelay(database.db, redis, controller.signal);
  return async () => {
    controller.abort();
    await running;
    await redis.close();
    await database.close();
  };
}

// startDailyPublisher keeps the daily challenge published when the worker has a database.
function startDailyPublisher(env: Env): Stop {
  if (!env.DATABASE_URL) {
    logger.warn("daily challenge publisher disabled; set DATABASE_URL to publish the daily challenge");
    return async () => undefined;
  }
  const database = connect(env.DATABASE_URL);
  const controller = new AbortController();
  const running = runDailyPublisher(database.db, controller.signal);
  return async () => {
    controller.abort();
    await running;
    await database.close();
  };
}

// startFinishedConsumer runs one attempt.finished job (XP, rating) when the worker has a database and
// Redis. Its blocking reads get their own Redis connection.
async function startFinishedConsumer(env: Env, handler: FinishedHandler): Promise<Stop> {
  if (!env.DATABASE_URL || !env.REDIS_URL) {
    logger.warn(`${handler.name} disabled; set DATABASE_URL and REDIS_URL`);
    return async () => undefined;
  }
  const database = connect(env.DATABASE_URL);
  const redis = createClient({ url: env.REDIS_URL });
  redis.on("error", (error: unknown) => logger.error("redis connection error", { error }));
  await redis.connect();
  const controller = new AbortController();
  const running = runFinishedConsumer({ db: database.db, redis, handler }, controller.signal);
  return async () => {
    controller.abort();
    redis.destroy();
    await running;
    await database.close();
  };
}

async function shutdown(server: Server, stops: Stop[]): Promise<void> {
  await Promise.all(stops.map((stop) => stop()));
  server.close((error) => {
    if (error) {
      logger.error("worker shutdown failed", { error });
      process.exitCode = 1;
    }
  });
}

main().catch((error: unknown) => {
  logger.error("worker failed to start", { error });
  process.exitCode = 1;
});
