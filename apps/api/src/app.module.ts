import { type DynamicModule, Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { DevUserGuard } from "./auth/dev-user.guard.js";
import type { ServicesEnv } from "./config/services-env.js";
import { AppErrorFilter } from "./errors/app-error.filter.js";
import { HealthController } from "./health/health.controller.js";
import { AttemptsModule } from "./attempts/attempts.module.js";
import { InfraModule } from "./infra/infra.module.js";
import { LeaderboardsModule } from "./leaderboards/leaderboards.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  controllers: [HealthController],
  // Every route needs a session unless it is @Public().
  providers: [
    { provide: APP_FILTER, useClass: AppErrorFilter },
    { provide: APP_GUARD, useClass: DevUserGuard },
  ],
})
export class AppModule {
  // forRoot adds the features that need PostgreSQL, Redis and the secrets.
  static forRoot(services: ServicesEnv): DynamicModule {
    return { module: AppModule, imports: [InfraModule.forRoot(services), AttemptsModule, UsersModule, LeaderboardsModule] };
  }
}
