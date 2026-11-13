const MS_PER_SECOND = 1_000;

// secondsUntilNextDaily: the daily challenge follows the UTC calendar (task 41a), so the next one arrives
// at the coming 00:00 UTC.
export function secondsUntilNextDaily(now: Date): number {
  const nextDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.ceil((nextDay - now.getTime()) / MS_PER_SECOND);
}
