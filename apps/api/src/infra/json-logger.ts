import { createLogger, type Logger, type LogWriter } from "@greenbuild/shared";
import type { LoggerService } from "@nestjs/common";

// Warnings and errors go to stderr, the rest to stdout, one redacted JSON line each.
const writeToStdio: LogWriter = (level, line) => (level === "warn" || level === "error" ? process.stderr : process.stdout).write(`${line}\n`);

// JsonLogger makes Nest log through the shared logger: one redacted JSON line per entry. Nest passes
// a message (text, object or error) and, last, the context, e.g. the class that logged it.
export class JsonLogger implements LoggerService {
  private readonly logger: Logger = createLogger("api", writeToStdio);

  log(message: unknown, ...rest: unknown[]): void {
    this.write("info", message, rest);
  }

  error(message: unknown, ...rest: unknown[]): void {
    this.write("error", message, rest);
  }

  warn(message: unknown, ...rest: unknown[]): void {
    this.write("warn", message, rest);
  }

  debug(message: unknown, ...rest: unknown[]): void {
    this.write("debug", message, rest);
  }

  verbose(message: unknown, ...rest: unknown[]): void {
    this.write("debug", message, rest);
  }

  private write(level: keyof Logger, message: unknown, rest: unknown[]): void {
    const context = typeof rest.at(-1) === "string" ? rest.at(-1) : undefined;
    const text = message instanceof Error ? message.message : typeof message === "string" ? message : "log";
    const detail = message instanceof Error || (typeof message === "object" && message !== null) ? { detail: message } : {};
    this.logger[level](text, { context, ...detail });
  }
}
