import { type DynamicModule, Logger, type Type } from "@nestjs/common";
import { AppModule } from "./app.module.js";
import { loadServicesEnv } from "./config/services-env.js";

const SERVICE_VARIABLES = ["DATABASE_URL", "REDIS_URL", "ATTACH_SECRET"] as const;

// rootModule turns attempts on once their services are configured; a partial setup fails startup.
export function rootModule(source: Record<string, string | undefined>): Type<AppModule> | DynamicModule {
  if (!SERVICE_VARIABLES.some((name) => source[name])) {
    new Logger("bootstrap").warn(`attempts disabled; set ${SERVICE_VARIABLES.join(", ")} to enable them`);
    return AppModule;
  }
  return AppModule.forRoot(loadServicesEnv(source));
}
