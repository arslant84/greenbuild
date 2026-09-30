import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AppErrorFilter } from "./errors/app-error.filter.js";
import { HealthController } from "./health/health.controller.js";

@Module({
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AppErrorFilter }],
})
export class AppModule {}
