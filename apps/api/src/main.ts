import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadEnv } from "./config/env.js";
import { rootModule } from "./root-module.js";

async function bootstrap(): Promise<void> {
  const env = loadEnv(process.env);
  const app = await NestFactory.create(rootModule(process.env));
  app.enableShutdownHooks();
  await app.listen(env.PORT);
}

await bootstrap();
