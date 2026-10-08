import type { Server } from "node:http";
import { connect } from "@greenbuild/db";
import { createClient } from "redis";
import { type Env, loadEnv } from "./config/env.js";
import { createHealthServer } from "./health/health-server.js";
import { logger } from "./logger.js";
import { runRelay } from "./outbox/relay.js";

const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM"] as const;

type Stop = () => Promise<void>;

async function main(): Promise<void> {
  const env = loadEnv(process.env);
  const server = createHealthServer();
  const stopRelay = await startRelay(env);

  server.listen(env.PORT, () => {
    logger.info("worker listening", { port: env.PORT });
  });

  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, () => void shutdown(server, stopRelay));
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

async function shutdown(server: Server, stopRelay: Stop): Promise<void> {
  await stopRelay();
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
