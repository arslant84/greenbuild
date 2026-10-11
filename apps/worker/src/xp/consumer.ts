import { hostname } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import type { Database } from "@greenbuild/db";
import { attemptFinishedSchema, QUEUE_PAYLOAD_FIELD, STREAM_ATTEMPT_FINISHED } from "@greenbuild/shared";
import { logger } from "../logger.js";
import { creditSolve } from "./credit.js";

// Every worker joins this group, so each attempt.finished is credited once.
export const XP_GROUP = "worker-xp";
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

type ReadReply = { messages: StreamMessage[] }[] | null;

// consumeXpBatch credits this consumer's pending messages, then waits up to blockMs for new ones. A
// message is acknowledged once credited or found invalid; a failure leaves it pending for a retry.
export async function consumeXpBatch(db: Database, redis: StreamReader, blockMs = BLOCK_MS): Promise<void> {
  await redis.xGroupCreate(STREAM_ATTEMPT_FINISHED, XP_GROUP, "0", { MKSTREAM: true }).catch((error: unknown) => {
    if (!String(error).includes("BUSYGROUP")) {
      throw error;
    }
  });
  for (const position of [OWN_PENDING, NEW_MESSAGES]) {
    const options = position === NEW_MESSAGES ? { COUNT: BATCH_SIZE, BLOCK: blockMs } : { COUNT: BATCH_SIZE };
    const reply = await redis.xReadGroup(XP_GROUP, hostname(), { key: STREAM_ATTEMPT_FINISHED, id: position }, options);
    for (const message of (reply as ReadReply)?.[0]?.messages ?? []) {
      await credit(db, redis, message);
    }
  }
}

async function credit(db: Database, redis: StreamReader, { id, message }: StreamMessage): Promise<void> {
  const event = attemptFinishedSchema.safeParse(parseJson(message[QUEUE_PAYLOAD_FIELD]));
  if (event.success) {
    await creditSolve(db, event.data);
  } else {
    // Redelivery cannot fix a malformed message.
    logger.warn("drop invalid attempt.finished message", { id });
  }
  await redis.xAck(STREAM_ATTEMPT_FINISHED, XP_GROUP, id);
}

// runXpConsumer credits until signal aborts; Redis or database errors are logged and retried.
export async function runXpConsumer(db: Database, redis: StreamReader, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    try {
      await consumeXpBatch(db, redis);
    } catch (error) {
      if (!signal.aborted) {
        logger.error("credit XP failed; retrying", { error });
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
