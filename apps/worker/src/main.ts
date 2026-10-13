import type { Server } from "node:http";
import { connect, type Database } from "@greenbuild/db";
import { createClient } from "redis";
import { type Env, loadEnv } from "./config/env.js";
import { runDailyPublisher } from "./daily/schedule.js";
import { createHealthServer } from "./health/health-server.js";
import { logger } from "./logger.js";
import { runRelay } from "./outbox/relay.js";
import { type FinishedHandler, runFinishedConsumer } from "./finished-consumer.js";
import { dailyBoardHandler } from "./leaderboards/boards.js";
import { runLeakCheck } from "./leaks/check.js";
import { BlobArchiveStore, smtpMailer } from "./privacy/export-delivery.js";
import { runDataExports } from "./privacy/export-job.js";
import { runPrivacyPurge } from "./privacy/purge.js";
import { ratingHandler } from "./rating/rate.js";
import { BlobSessionLogs } from "./signals/logs.js";
import { streakHandler } from "./streaks/count.js";
import { xpHandler } from "./xp/credit.js";

const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM"] as const;
// Jobs that need only the database and run on their own schedule.
const DATABASE_JOBS: [string, DatabaseJob][] = [
  ["daily challenge publisher", runDailyPublisher],
  ["leak check", runLeakCheck],
  ["account purge", runPrivacyPurge],
];
// The jobs that follow attempt.finished, each in its own consumer group.
const FINISHED_HANDLERS = [xpHandler, ratingHandler, streakHandler, dailyBoardHandler];

type Stop = () => Promise<void>;

async function main(): Promise<void> {
  const env = loadEnv(process.env);
  const server = createHealthServer();
  const stops = [await startRelay(env)];
  for (const [name, job] of [...DATABASE_JOBS, ...exportJob(env)]) {
    stops.push(startDatabaseJob(env, name, job));
  }
  for (const handler of FINISHED_HANDLERS) {
    stops.push(await startFinishedConsumer(env, handler));
  }

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
  const logs = env.SESSION_BLOB_CONNECTION_STRING ? new BlobSessionLogs(env.SESSION_BLOB_CONNECTION_STRING) : null;
  const running = runFinishedConsumer({ db: database.db, redis, handler, logs }, controller.signal);
  return async () => {
    controller.abort();
    redis.destroy();
    await running;
    await database.close();
  };
}

type DatabaseJob = (db: Database, signal: AbortSignal) => Promise<void>;

// exportJob is the data export job (task 50a) when its settings are there.
function exportJob(env: Env): [string, DatabaseJob][] {
  const { EXPORT_BLOB_CONNECTION_STRING: blob, EMAIL_SERVER: server, EMAIL_FROM: from, WEB_URL: webUrl } = env;
  if (!blob || !server || !from || !webUrl) {
    logger.warn("data export disabled; set EXPORT_BLOB_CONNECTION_STRING, EMAIL_SERVER, EMAIL_FROM and WEB_URL");
    return [];
  }
  const archives = new BlobArchiveStore(blob);
  const mail = smtpMailer(server, from);
  return [["data export", (db, signal) => runDataExports({ db, archives, mail, webUrl: webUrl.replace(/\/$/, "") }, signal)]];
}

// startDatabaseJob runs a job that needs only the database, when the worker has one.
function startDatabaseJob(env: Env, name: string, job: DatabaseJob): Stop {
  if (!env.DATABASE_URL) {
    logger.warn(`${name} disabled; set DATABASE_URL`);
    return async () => undefined;
  }
  const database = connect(env.DATABASE_URL);
  const controller = new AbortController();
  const running = job(database.db, controller.signal);
  return async () => {
    controller.abort();
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
