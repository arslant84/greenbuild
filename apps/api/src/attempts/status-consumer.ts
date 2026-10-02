import { hostname } from "node:os";
import { QUEUE_PAYLOAD_FIELD, STREAM_SANDBOX_STATUS, sandboxStatusSchema } from "@greenbuild/shared";
import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { RedisClient, type RedisConnection } from "../infra/services.js";
import { AttemptStatusUpdates } from "./attempt-status.js";

// Every API instance joins this group, so each status is applied once.
export const STATUS_GROUP = "api";
const BLOCK_MS = 5_000;
const BATCH_SIZE = 10;
const RETRY_DELAY_MS = 1_000;
const NEW_MESSAGES = ">";
// Reading from 0 returns this consumer's own unacknowledged messages: those that failed to apply.
const OWN_PENDING = "0";

interface StreamMessage {
  id: string;
  message: Record<string, unknown>;
}

// StatusConsumer reads sandbox.status for as long as the API runs. Redis or database errors are
// logged and retried; a message is acknowledged only after it was applied or found invalid.
@Injectable()
export class StatusConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(StatusConsumer.name);
  private readonly name = hostname();
  private running = false;
  private loop: Promise<void> | undefined;
  private connection: RedisConnection | undefined;

  constructor(
    private readonly redis: RedisClient,
    private readonly updates: AttemptStatusUpdates,
  ) {}

  onApplicationBootstrap(): void {
    this.running = true;
    this.loop = this.run();
  }

  async onApplicationShutdown(): Promise<void> {
    this.running = false;
    this.connection?.destroy();
    await this.loop;
  }

  private async run(): Promise<void> {
    while (this.running) {
      try {
        await this.poll();
      } catch (error) {
        if (this.running) {
          this.logger.warn(`read ${STREAM_SANDBOX_STATUS}: ${String(error)}`);
          this.connection?.destroy();
          this.connection = undefined;
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }
  }

  private async poll(): Promise<void> {
    const connection = await this.connected();
    for (const position of [OWN_PENDING, NEW_MESSAGES]) {
      const options = position === NEW_MESSAGES ? { COUNT: BATCH_SIZE, BLOCK: BLOCK_MS } : { COUNT: BATCH_SIZE };
      const reply = await connection.xReadGroup(STATUS_GROUP, this.name, { key: STREAM_SANDBOX_STATUS, id: position }, options);
      for (const message of (reply?.[0]?.messages ?? []) as StreamMessage[]) {
        await this.handle(connection, message);
      }
    }
  }

  private async connected(): Promise<RedisConnection> {
    if (this.connection) {
      return this.connection;
    }
    const connection = await this.redis.dedicated();
    await connection.xGroupCreate(STREAM_SANDBOX_STATUS, STATUS_GROUP, "0", { MKSTREAM: true }).catch((error: unknown) => {
      if (!String(error).includes("BUSYGROUP")) {
        throw error;
      }
    });
    this.connection = connection;
    return connection;
  }

  private async handle(connection: RedisConnection, { id, message }: StreamMessage): Promise<void> {
    const status = sandboxStatusSchema.safeParse(parseJson(message[QUEUE_PAYLOAD_FIELD]));
    if (status.success) {
      await this.updates.apply(status.data);
    } else {
      // Redelivery cannot fix a malformed message.
      this.logger.warn(`drop invalid ${STREAM_SANDBOX_STATUS} message ${id}`);
    }
    await connection.xAck(STREAM_SANDBOX_STATUS, STATUS_GROUP, id);
  }
}

function parseJson(payload: unknown): unknown {
  try {
    return JSON.parse(String(payload));
  } catch {
    return undefined;
  }
}
