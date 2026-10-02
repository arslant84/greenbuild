import { type DynamicModule, Global, Module } from "@nestjs/common";
import type { ServicesEnv } from "../config/services-env.js";
import { DatabaseClient, RedisClient, SERVICES_ENV } from "./services.js";

@Global()
@Module({})
export class InfraModule {
  static forRoot(env: ServicesEnv): DynamicModule {
    const providers = [{ provide: SERVICES_ENV, useValue: env }, DatabaseClient, RedisClient];
    return { module: InfraModule, providers, exports: providers };
  }
}
