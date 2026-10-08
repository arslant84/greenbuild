import { redact } from "./redact.js";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

export interface Logger {
  debug: (message: string, fields?: LogFields) => void;
  info: (message: string, fields?: LogFields) => void;
  warn: (message: string, fields?: LogFields) => void;
  error: (message: string, fields?: LogFields) => void;
}

// LogWriter puts one finished line somewhere; each app passes one for its runtime, since this package
// runs both on servers and in the browser.
export type LogWriter = (level: LogLevel, line: string) => void;

// createLogger writes one JSON object per line, with the message and every field redacted.
export function createLogger(service: string, write: LogWriter): Logger {
  const log = (level: LogLevel) => (message: string, fields: LogFields = {}) => {
    write(level, JSON.stringify({ time: new Date().toISOString(), level, service, msg: redact(message), ...(redact(fields) as LogFields) }));
  };
  return { debug: log("debug"), info: log("info"), warn: log("warn"), error: log("error") };
}
