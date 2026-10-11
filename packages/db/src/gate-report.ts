import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { and, count, countDistinct, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { connect, type Database } from "./client.js";
import { loadDatabaseUrl } from "./config.js";
import { attempts } from "./schema/index.js";

// architecture.md, Stage 1 gate (task 39a): p95 start < 20 s, < 3% failed starts, 20 engineers solve.
export interface GateReport {
  since: Date;
  // From attempt creation to ready; null when no attempt became ready.
  p95StartMs: number | null;
  readyStarts: number;
  // Attempts that failed before ready; a failure after ready (abuse) is not a failed start.
  failedStarts: number;
  failedStartShare: number | null;
  solvers: number;
}

// gateReport measures attempts created at or after since. Starts abandoned before ready count as
// neither ready nor failed.
export async function gateReport(db: Database, since: Date): Promise<GateReport> {
  const created = gte(attempts.createdAt, since);
  const startMs = sql`extract(epoch from (${attempts.startedAt} - ${attempts.createdAt})) * 1000`;
  const [ready] = await db
    .select({ readyStarts: count(), p95StartMs: sql<string | null>`percentile_disc(0.95) within group (order by ${startMs})` })
    .from(attempts)
    .where(and(created, isNotNull(attempts.startedAt)));
  const [failed] = await db
    .select({ failedStarts: count() })
    .from(attempts)
    .where(and(created, eq(attempts.status, "failed"), isNull(attempts.startedAt)));
  const [solved] = await db
    .select({ solvers: countDistinct(attempts.userId) })
    .from(attempts)
    .where(and(created, eq(attempts.status, "solved")));
  const readyStarts = ready?.readyStarts ?? 0;
  const failedStarts = failed?.failedStarts ?? 0;
  const starts = readyStarts + failedStarts;
  return {
    since,
    p95StartMs: ready?.p95StartMs == null ? null : Math.round(Number(ready.p95StartMs)),
    readyStarts,
    failedStarts,
    failedStartShare: starts === 0 ? null : failedStarts / starts,
    solvers: solved?.solvers ?? 0,
  };
}

const sinceSchema = z.iso.date();

// parseSince reads --since YYYY-MM-DD as midnight UTC.
export function parseSince(args: string[]): Date {
  const { values } = parseArgs({ args, options: { since: { type: "string" } } });
  const parsed = sinceSchema.safeParse(values.since);
  if (!parsed.success) {
    throw new Error("report:gate --since: must be a date like 2026-10-01");
  }
  return new Date(`${parsed.data}T00:00:00Z`);
}

export function formatGateReport(report: GateReport): string {
  const share = report.failedStartShare === null ? "—" : `${(report.failedStartShare * 100).toFixed(1)}%`;
  return [
    `Stage 1 gate, attempts since ${report.since.toISOString().slice(0, 10)}`,
    `p95 start: ${report.p95StartMs === null ? "—" : `${(report.p95StartMs / 1000).toFixed(1)} s`} (gate < 20 s)`,
    `failed starts: ${share} (${report.failedStarts} of ${report.readyStarts + report.failedStarts}; gate < 3%)`,
    `players with a solve: ${report.solvers} (gate 20)`,
  ].join("\n");
}

async function main(args: string[]): Promise<void> {
  const since = parseSince(args);
  const connection = connect(loadDatabaseUrl());
  try {
    console.log(formatGateReport(await gateReport(connection.db, since)));
  } finally {
    await connection.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    // Drizzle's "Failed query" error keeps the reason (e.g. connection refused) in cause.
    const cause = error instanceof Error && error.cause instanceof Error ? `\n${error.cause.message}` : "";
    console.error(`${error instanceof Error ? error.message : String(error)}${cause}`);
    process.exitCode = 1;
  }
}
