import { hostname } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import type { Database } from "@greenbuild/db";
import { type AttemptFinished, attemptFinishedSchema, QUEUE_PAYLOAD_FIELD, STREAM_ATTEMPT_FINISHED } from "@greenbuild/shared";
import { logger } from "./logger.js";
import type { SessionLogs } from "./signals/logs.js";

const BLOCK_MS = 5_000;
const BATCH_SIZE = 10;
const RETRY_DELAY_MS = 1_000;
const NEW_MESSAGES = ">";
// Reading from 0 returns this consumer's own unacknowledged messages: those that failed before.
const OWN_PENDING = "0";

interface StreamMessage {
  id: string;
  message: Record<string, unknown>;
}

// StreamReader is the part of a node-redis client the consumer uses.
export interface StreamReader {
  xGroupCreate(key: string, group: string, id: string, options: { MKSTREAM: true }): Promise<unknown>;
  xReadGroup(group: string, consumer: string, stream: { key: string; id: string }, options: { COUNT: number; BLOCK?: number }): Promise<unknown>;
  xAck(key: string, group: string, id: string): Promise<unknown>;
}

// Boards is the part of a node-redis client the leaderboard updates use (task 45a).
export interface Boards {
  zAdd(key: string, member: { score: number; value: string }): Promise<unknown>;
  zRem(key: string, member: string): Promise<unknown>;
}

// HandlerDeps is what a job gets: the database, Redis for the leaderboards, and the session logs when
// the worker can read them.
export interface HandlerDeps {
  db: Database;
  boards: Boards;
  logs: SessionLogs | null;
}

type ReadReply = { messages: StreamMessage[] }[] | null;

// FinishedHandler is one job that follows attempt.finished (XP, rating, …). Each has its own consumer
// group, so every job sees every event once, whichever worker reads it.
export interface FinishedHandler {
  group: string;
  name: string;
  handle: (deps: HandlerDeps, event: AttemptFinished) => Promise<void>;
}

export interface FinishedConsumer {
  db: Database;
  redis: StreamReader & Boards;
  handler: FinishedHandler;
  logs: SessionLogs | null;
}

// consumeFinishedBatch handles this consumer's pending messages, then waits up to blockMs for new ones.
// A message is acknowledged once handled or found invalid; a failure leaves it pending for a retry.
export async function consumeFinishedBatch({ db, redis, handler, logs }: FinishedConsumer, blockMs = BLOCK_MS): Promise<void> {
  await redis.xGroupCreate(STREAM_ATTEMPT_FINISHED, handler.group, "0", { MKSTREAM: true }).catch((error: unknown) => {
    if (!String(error).includes("BUSYGROUP")) {
      throw error;
    }
  });
  for (const position of [OWN_PENDING, NEW_MESSAGES]) {
    const options = position === NEW_MESSAGES ? { COUNT: BATCH_SIZE, BLOCK: blockMs } : { COUNT: BATCH_SIZE };
    const reply = await redis.xReadGroup(handler.group, hostname(), { key: STREAM_ATTEMPT_FINISHED, id: position }, options);
    for (const { id, message } of (reply as ReadReply)?.[0]?.messages ?? []) {
      const event = attemptFinishedSchema.safeParse(parseJson(message[QUEUE_PAYLOAD_FIELD]));
      if (event.success) {
        await handler.handle({ db, boards: redis, logs }, event.data);
      } else {
        // Redelivery cannot fix a malformed message.
        logger.warn("drop invalid attempt.finished message", { id, group: handler.group });
      }
      await redis.xAck(STREAM_ATTEMPT_FINISHED, handler.group, id);
    }
  }
}

// runFinishedConsumer handles events until signal aborts; Redis or database errors are logged and retried.
export async function runFinishedConsumer(consumer: FinishedConsumer, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    try {
      await consumeFinishedBatch(consumer);
    } catch (error) {
      if (!signal.aborted) {
        logger.error(`${consumer.handler.name} failed; retrying`, { error });
        await sleep(RETRY_DELAY_MS, undefined, { signal }).catch(() => undefined);
      }
    }
  }
}

function parseJson(payload: unknown): unknown {
  try {
    return JSON.parse(String(payload));
  } catch {
    return undefined;
  }
}
