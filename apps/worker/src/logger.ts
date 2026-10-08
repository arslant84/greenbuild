import { createLogger, type LogWriter } from "@greenbuild/shared";

// Warnings and errors go to stderr, the rest to stdout, one redacted JSON line each.
const writeToStdio: LogWriter = (level, line) => (level === "warn" || level === "error" ? process.stderr : process.stdout).write(`${line}\n`);

export const logger = createLogger("worker", writeToStdio);
