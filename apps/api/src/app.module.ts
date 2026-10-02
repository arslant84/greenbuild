import { type DynamicModule, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import type { ServicesEnv } from "./config/services-env.js";
import { AppErrorFilter } from "./errors/app-error.filter.js";
import { HealthController } from "./health/health.controller.js";
import { InfraModule } from "./infra/infra.module.js";

@Module({
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AppErrorFilter }],
})
export class AppModule {
  // forRoot adds the features that need PostgreSQL, Redis and the secrets.
  static forRoot(services: ServicesEnv): DynamicModule {
    return { module: AppModule, imports: [InfraModule.forRoot(services)] };
  }
}
