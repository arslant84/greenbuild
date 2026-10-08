// Logs must never carry credentials (CLAUDE.md, security). redact masks them before anything is written:
// values under sensitive keys, and passwords inside connection strings wherever they appear.
export const REDACTED = "[REDACTED]";

// Matched against lower-cased keys: whole names, and parts that only ever name a secret.
const SENSITIVE_KEYS = new Set(["authorization", "cookie", "set-cookie", "password", "passwd", "secret"]);
const SENSITIVE_KEY_PARTS = ["token", "secret", "password", "api_key", "apikey", "private_key"];
// scheme://user:password@host, e.g. postgres://app:pw@db:5432/app or redis://:pw@cache:6379.
const CREDENTIALS_IN_URL = /([a-z][a-z0-9+.-]*:\/\/[^:/@\s]*:)[^@\s]*@/gi;
const MAX_DEPTH = 8;

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.has(lower) || SENSITIVE_KEY_PARTS.some((part) => lower.includes(part));
}

function redactText(text: string): string {
  return text.replace(CREDENTIALS_IN_URL, `$1${REDACTED}@`);
}

function redactError(error: Error, depth: number): Record<string, unknown> {
  return { name: error.name, message: redactText(error.message), stack: error.stack === undefined ? undefined : redactText(error.stack), cause: redactAt(error.cause, depth + 1) };
}

function redactAt(value: unknown, depth: number): unknown {
  if (typeof value === "string") return redactText(value);
  if (value === null || typeof value !== "object") return value;
  if (depth > MAX_DEPTH) return "[TRUNCATED]";
  if (value instanceof Error) return redactError(value, depth);
  if (Array.isArray(value)) return value.map((item) => redactAt(item, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, isSensitiveKey(key) ? REDACTED : redactAt(item, depth + 1)]));
}

// redact returns a copy of value that is safe to log.
export function redact(value: unknown): unknown {
  return redactAt(value, 0);
}
