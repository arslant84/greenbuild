const UNIQUE_VIOLATION = "23505";

// violatesUnique reports whether a query failed on the named unique constraint. Drizzle wraps the
// driver's error, so the PostgreSQL code sits on the cause.
export function violatesUnique(error: unknown, constraint: string): boolean {
  const cause = error instanceof Error && error.cause !== undefined ? error.cause : error;
  const details = cause as { code?: unknown; constraint_name?: unknown };
  return details.code === UNIQUE_VIOLATION && details.constraint_name === constraint;
}
