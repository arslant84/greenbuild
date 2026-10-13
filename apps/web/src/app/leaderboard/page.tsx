import { meResponseSchema } from "@greenbuild/shared";
import { apiGet } from "../../server/api";
import { BoardHeading } from "./_board/board-heading";
import { BoardTabs } from "./_board/board-tabs";
import { readBoardParams } from "./_board/board-view";
import { ContextCards, StandingsFooter } from "./_board/context-cards";
import { StandingsHeader } from "./_board/standings-header";

export const dynamic = "force-dynamic";

// Figma "Hotfix — Global Engineering Standings & Leaderboards" (3:3639), task 45b.
export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = readBoardParams(await searchParams);
  const me = await apiGet("/v1/me", meResponseSchema);
  return (
    <div className="min-h-screen bg-[#131314]">
      {/* The 1280 px frame, centered on wider windows (owner, 2026-10-05). */}
      <div className="mx-auto flex min-h-screen w-7xl flex-col">
        <StandingsHeader handle={me?.handle ?? null} streak={me ? me.streak.current : null} />
        <main className="flex flex-1 flex-col gap-5 px-8 py-5">
          <BoardHeading tab={params.tab} now={new Date()} />
          <BoardTabs current={params.tab} />
          <ContextCards />
        </main>
        <StandingsFooter />
      </div>
    </div>
  );
}
