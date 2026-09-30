import { loadEnv } from "./config/env.js";
import { createHealthServer } from "./health/health-server.js";

const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM"] as const;

function main(): void {
  const env = loadEnv(process.env);
  const server = createHealthServer();

  server.listen(env.PORT, () => {
    console.info(`worker listening on port ${env.PORT}`);
  });

  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, () => {
      server.close((error) => {
        if (error) {
          console.error("worker shutdown failed", error);
          process.exitCode = 1;
        }
      });
    });
  }
}

main();
