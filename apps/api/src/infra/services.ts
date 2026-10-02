import { Inject, Injectable, Logger, type OnApplicationShutdown } from "@nestjs/common";
import { connect, type Database, type DatabaseConnection } from "@greenbuild/db";
import { createClient } from "redis";
import type { ServicesEnv } from "../config/services-env.js";

export const SERVICES_ENV = Symbol("SERVICES_ENV");

export type RedisConnection = ReturnType<typeof createClient>;

// DatabaseClient holds the pool; postgres.js connects on the first query.
@Injectable()
export class DatabaseClient implements OnApplicationShutdown {
  private readonly connection: DatabaseConnection;

  constructor(@Inject(SERVICES_ENV) env: ServicesEnv) {
    this.connection = connect(env.DATABASE_URL);
  }

  get db(): Database {
    return this.connection.db;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.connection.close();
  }
}

// RedisClient connects on first use, so the API starts while Redis is still coming up.
@Injectable()
export class RedisClient implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisClient.name);
  private readonly client: RedisConnection;
  private connecting: Promise<unknown> | undefined;

  constructor(@Inject(SERVICES_ENV) env: ServicesEnv) {
    this.client = createClient({ url: env.REDIS_URL });
    // Without a listener a connection error crashes the process. The URL holds the password and is never logged.
    this.client.on("error", (error: unknown) => this.logger.warn(`redis: ${String(error)}`));
  }

  async connected(): Promise<RedisConnection> {
    this.connecting ??= this.client.connect().catch((error: unknown) => {
      this.connecting = undefined;
      throw error;
    });
    await this.connecting;
    return this.client;
  }

  // dedicated opens a separate connection for blocking reads, which would otherwise hold up every
  // other command on the shared one. The caller closes it.
  async dedicated(): Promise<RedisConnection> {
    const connection = this.client.duplicate();
    connection.on("error", (error: unknown) => this.logger.warn(`redis: ${String(error)}`));
    await connection.connect();
    return connection;
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.close();
    }
  }
}
