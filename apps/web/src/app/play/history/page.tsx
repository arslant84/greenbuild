import { attemptHistoryResponseSchema, meResponseSchema } from "@greenbuild/shared";
import Link from "next/link";
import { apiGet } from "../../../server/api";
import { Sidebar } from "../_daily/sidebar";
import { StatusBar } from "../_daily/status-bar";
import { ServiceError } from "../service-error";
import { HistoryStats, ModeFilter } from "./history-summary";
import { EmptyHistory, HistoryTable } from "./history-rows";
import { FULL_HISTORY_PATH, historyMode, historyTableRows, historyTotals } from "./history-table";

export const dynamic = "force-dynamic";

// Stitch "Hotfix — Attempt History" (deviation 36): the Daily screen's shell around the player's latest
// finished attempts, their totals and a filter by mode.
export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ mode?: string | string[] }> }) {
  const [player, history, { mode: modeParam }] = await Promise.all([
    apiGet("/v1/me", meResponseSchema),
    apiGet(FULL_HISTORY_PATH, attemptHistoryResponseSchema),
    searchParams,
  ]);
  const mode = historyMode(modeParam);
  return (
    <div data-responsive className="min-h-screen bg-canvas lg:min-w-[1280px]">
      <div className="frame flex flex-col lg:flex-row">
        <Sidebar player={player} />
        <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 pt-5 pb-8 lg:px-3">
          <StatusBar player={player} />
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-[13px] leading-[18px]">
            <Link href="/play" className="text-ink-muted hover:text-ink">
              Daily
            </Link>
            <span className="text-[#3c494c]">/</span>
            <span className="font-medium text-ink">History</span>
          </nav>
          <div className="flex flex-col gap-1">
            <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.8px] text-ink lg:text-[32px] lg:leading-10">Attempt history</h1>
            <p className="type-body text-ink-muted">Your finished attempts, newest first</p>
          </div>
          {history ? (
            <>
              <HistoryStats totals={historyTotals(history.attempts)} />
              <ModeFilter active={mode} />
              <AttemptsCard rows={historyTableRows(history.attempts, mode)} />
            </>
          ) : (
            <ServiceError retryHref="/play/history" message="Your attempts could not be loaded." />
          )}
        </main>
      </div>
    </div>
  );
}

function AttemptsCard({ rows }: { rows: ReturnType<typeof historyTableRows> }) {
  if (rows.length === 0) {
    return <EmptyHistory />;
  }
  return (
    <>
      <HistoryTable rows={rows} />
      <p className="type-label px-1 text-ink-muted/70">Showing your latest {rows.length} attempts</p>
    </>
  );
}
