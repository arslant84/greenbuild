import { leaderboardResponseSchema, meResponseSchema } from "@greenbuild/shared";
import { apiGet } from "../../server/api";
import { ServiceError } from "../play/service-error";
import { BoardHeading } from "./_board/board-heading";
import { BoardTable } from "./_board/board-table";
import { BoardTabs } from "./_board/board-tabs";
import { boardApiPath, readBoardParams } from "./_board/board-view";
import { ContextCards, StandingsFooter } from "./_board/context-cards";
import { StandingsHeader } from "./_board/standings-header";
import { YourRow } from "./_board/your-row";

export const dynamic = "force-dynamic";

// The frame shows twelve rows.
const ROWS = 12;

// Figma "Hotfix — Global Engineering Standings & Leaderboards" (3:3639), task 45b. Below 1024 px the Stitch
// phone screen "Greenbuild — Global Engineering Standings (Phone)" (task 56).
export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = readBoardParams(await searchParams);
  const me = await apiGet("/v1/me", meResponseSchema);
  const path = boardApiPath(params, me?.country ?? null, ROWS);
  const board = path ? await apiGet(path, leaderboardResponseSchema) : { kind: "weekly" as const, entries: [], me: null };
  const now = new Date();
  const handle = me?.handle ?? null;
  const streak = me ? me.streak.current : null;
  return (
    <div data-responsive className="flex min-h-screen flex-col bg-[#131314] lg:min-w-[1280px]">
      <StandingsHeader handle={handle} streak={streak} />
      {/* The content and its header and footer bars span the whole window (owner, 2026-10-14). */}
      <main className="frame flex flex-1 flex-col gap-5 px-4 py-5 lg:px-8">
        <BoardHeading tab={params.tab} now={now} />
        <BoardTabs current={params.tab} />
        {board ? (
          <>
            <BoardTable tab={params.tab} entries={board.entries} emptyText={path ? "No players on this board yet." : "Set your country to see its board."} />
            <YourRow tab={params.tab} handle={handle} me={board.me} listed={board.me !== null && board.me.rank <= board.entries.length} streak={streak} />
          </>
        ) : (
          <ServiceError retryHref="/leaderboard" />
        )}
        <ContextCards />
      </main>
      <StandingsFooter />
    </div>
  );
}
