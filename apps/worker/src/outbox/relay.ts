import { setTimeout as sleep } from "node:timers/promises";
import { type Database, inArray, outbox, sql } from "@greenbuild/db";
import { QUEUE_PAYLOAD_FIELD } from "@greenbuild/shared";
import { logger } from "../logger.js";

export const RELAY_BATCH_SIZE = 100;
const IDLE_DELAY_MS = 1_000;
// Consumers ack what they read; the cap only bounds a stream nobody consumes.
const STREAM_MAX_LENGTH = 100_000;

// Publisher is the part of a node-redis client the relay uses.
export interface Publisher {
  xAdd(stream: string, id: string, fields: Record<string, string>, options: { TRIM: { strategy: "MAXLEN"; strategyModifier: "~"; threshold: number } }): Promise<unknown>;
}

// relayBatch publishes the oldest unpublished outbox rows to their streams and marks them, in one
// transaction: if a publish fails the marks roll back and the rows go out again, so delivery is at
// least once (consumers dedupe by the event's id, e.g. attempt_id). SKIP LOCKED lets several
// workers share the outbox without taking the same rows.
export async function relayBatch(db: Database, publisher: Publisher): Promise<number> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: outbox.id, topic: outbox.topic, payload: outbox.payload })
      .from(outbox)
      .where(sql`${outbox.publishedAt} is null`)
      .orderBy(outbox.createdAt)
      .limit(RELAY_BATCH_SIZE)
      .for("update", { skipLocked: true });
    for (const row of rows) {
      await publisher.xAdd(row.topic, "*", { [QUEUE_PAYLOAD_FIELD]: JSON.stringify(row.payload) }, {
        TRIM: { strategy: "MAXLEN", strategyModifier: "~", threshold: STREAM_MAX_LENGTH },
      });
    }
    if (rows.length > 0) {
      await tx.update(outbox).set({ publishedAt: new Date() }).where(inArray(outbox.id, rows.map((row) => row.id)));
    }
    return rows.length;
  });
}

// runRelay relays until signal aborts: a full batch goes again at once, otherwise it waits a second.
// Errors are logged and retried, so a database or Redis restart does not stop the worker.
export async function runRelay(db: Database, publisher: Publisher, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    let relayed = 0;
    try {
      relayed = await relayBatch(db, publisher);
    } catch (error) {
      logger.error("relay outbox failed; retrying", { error });
    }
    if (relayed < RELAY_BATCH_SIZE) {
      await sleep(IDLE_DELAY_MS, undefined, { signal }).catch(() => undefined);
    }
  }
}
