import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { loadEnv } from "./config/env.js";
import { JsonLogger } from "./infra/json-logger.js";
import { rootModule } from "./root-module.js";

async function bootstrap(): Promise<void> {
  const env = loadEnv(process.env);
  // Before the root module, which may already log while it decides which modules to load.
  const logger = new JsonLogger();
  Logger.overrideLogger(logger);
  const app = await NestFactory.create(rootModule(process.env), { logger });
  app.enableShutdownHooks();
  await app.listen(env.PORT);
}

await bootstrap();
