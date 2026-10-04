import { randomUUID } from "node:crypto";
import { applyMigrations, connect, outbox, sql } from "@greenbuild/db";
import { QUEUE_PAYLOAD_FIELD } from "@greenbuild/shared";
import { type Container, startContainer } from "@greenbuild/testkit";
import { createClient } from "redis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Publisher, RELAY_BATCH_SIZE, relayBatch, runRelay } from "./relay.js";

const TOPIC = "attempt.finished";
type Connection = ReturnType<typeof connect>;
type Redis = ReturnType<typeof createClient>;

let containers: Container[] = [];
let database: Connection;
let redis: Redis;

beforeAll(async () => {
  const pg = await startContainer({
    image: "postgres:16-alpine",
    port: 5432,
    env: { POSTGRES_PASSWORD: "test" },
    ready: async (address) => {
      const probe = connect(`postgres://postgres:test@${address}/postgres`);
      await probe.db.execute(sql`select 1`).finally(() => probe.close());
    },
  });
  const rd = await startContainer({
    image: "redis:8-alpine",
    port: 6379,
    ready: async (address) => {
      const probe = createClient({ url: `redis://${address}` });
      probe.on("error", () => undefined);
      await probe.connect();
      await probe.close();
    },
  });
  containers = [pg, rd];
  const databaseUrl = `postgres://postgres:test@${pg.address}/postgres`;
  await applyMigrations(databaseUrl);
  database = connect(databaseUrl);
  redis = createClient({ url: `redis://${rd.address}` });
  await redis.connect();
}, 120_000);

afterAll(async () => {
  await redis?.close();
  await database?.close();
  await Promise.all(containers.map((container) => container.stop()));
});

async function addEvent(): Promise<string> {
  const attemptId = randomUUID();
  await database.db.insert(outbox).values({ topic: TOPIC, payload: { attempt_id: attemptId } });
  return attemptId;
}

async function published(attemptId: string): Promise<{ inStream: number; marked: boolean }> {
  const entries = await redis.xRange(TOPIC, "-", "+");
  const inStream = (entries ?? []).filter((entry) => String(entry.message[QUEUE_PAYLOAD_FIELD]).includes(attemptId)).length;
  const rows = await database.db.select({ payload: outbox.payload, publishedAt: outbox.publishedAt }).from(outbox);
  const row = rows.find((candidate) => JSON.stringify(candidate.payload).includes(attemptId));
  return { inStream, marked: row?.publishedAt !== null };
}

describe("relayBatch on PostgreSQL and Redis", () => {
  it("publishes an outbox row once and marks it", async () => {
    const attemptId = await addEvent();
    expect(await relayBatch(database.db, redis)).toBeGreaterThanOrEqual(1);
    expect(await relayBatch(database.db, redis)).toBe(0);

    expect(await published(attemptId)).toEqual({ inStream: 1, marked: true });
  });

  it("keeps the row when publishing fails, and sends it on the next try", async () => {
    const attemptId = await addEvent();
    const broken: Publisher = { xAdd: () => Promise.reject(new Error("redis down")) };
    await expect(relayBatch(database.db, broken)).rejects.toThrow("redis down");
    expect(await published(attemptId)).toEqual({ inStream: 0, marked: false });

    await relayBatch(database.db, redis);
    expect(await published(attemptId)).toEqual({ inStream: 1, marked: true });
  });

  it("drains a backlog larger than one batch", async () => {
    const ids = await Promise.all(Array.from({ length: RELAY_BATCH_SIZE + 1 }, () => addEvent()));
    const controller = new AbortController();
    const running = runRelay(database.db, redis, controller.signal);
    await expect.poll(async () => (await published(ids.at(-1) ?? "")).marked, { timeout: 10_000 }).toBe(true);
    controller.abort();
    await running;

    const unpublished = await database.db.select({ id: outbox.id }).from(outbox).where(sql`${outbox.publishedAt} is null`);
    expect(unpublished).toEqual([]);
  });
});
