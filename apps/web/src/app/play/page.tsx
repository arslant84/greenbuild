import {
  type AttemptResponse,
  attemptHistoryResponseSchema,
  attemptListResponseSchema,
  type ChallengeCard as Card,
  challengeCardSchema,
  type DailyResponse,
  dailyResponseSchema,
  leaderboardResponseSchema,
  meResponseSchema,
} from "@greenbuild/shared";
import { apiGet } from "../../server/api";
import { ActiveAttemptCard } from "./_daily/active-attempt-card";
import { ChallengeCard } from "./_daily/challenge-card";
import { HISTORY_PATH, recentRows, yesterdaysDaily } from "./_daily/history-view";
import { RecentAttempts } from "./_daily/recent-attempts";
import { RightAside } from "./_daily/right-aside";
import { Sidebar } from "./_daily/sidebar";
import { StatusBar } from "./_daily/status-bar";
import { TOP_FIVE_PATH, weekLabel } from "./_daily/top-five";
import { ServiceError } from "./service-error";

export const dynamic = "force-dynamic";

// Figma "Hotfix — Daily Challenge" (1280 × 1024). Below 1024 px the Stitch phone screen "Greenbuild — Daily
// Challenge (Phone)": the sidebar becomes a top bar and the right column moves below (task 56).
export default async function DailyPage() {
  // Today's challenge as the worker published it (task 41c); none yet shows the service error.
  const [daily, player, active, topFive, history] = await Promise.all([
    apiGet("/v1/daily", dailyResponseSchema),
    apiGet("/v1/me", meResponseSchema),
    runningAttempt(),
    apiGet(TOP_FIVE_PATH, leaderboardResponseSchema),
    apiGet(HISTORY_PATH, attemptHistoryResponseSchema),
  ]);
  const now = new Date();
  const finished = history?.attempts ?? [];
  const running = active && (await withCard(active, daily));
  return (
    <div data-responsive className="min-h-screen bg-canvas lg:min-w-[1280px]">
      {/* The content spans the whole window (owner, 2026-10-14); the asides keep their width. */}
      <div className="frame flex flex-col lg:flex-row">
        <Sidebar player={player} />
        <div className="flex min-w-0 flex-1 flex-col pb-8 lg:flex-row lg:justify-between">
          <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 pt-5 lg:px-3">
            <StatusBar player={player} />
            {running && <ActiveAttemptCard attempt={running.attempt} card={running.card} />}
            {daily ? <ChallengeCard card={daily.challenge} blocked={active !== undefined} /> : <ServiceError />}
            <RecentAttempts rows={recentRows(finished, now)} />
          </main>
          <RightAside topFive={topFive} week={weekLabel(now)} yesterday={yesterdaysDaily(finished, now)} />
        </div>
      </div>
    </div>
  );
}

// runningAttempt is the player's starting or ready attempt, at any challenge (task 21b).
async function runningAttempt(): Promise<AttemptResponse | undefined> {
  return (await apiGet("/v1/attempts?status=active", attemptListResponseSchema))?.attempts[0];
}

// withCard adds the running attempt's challenge card: today's card when it is today's challenge.
async function withCard(attempt: AttemptResponse, daily: DailyResponse | null): Promise<{ attempt: AttemptResponse; card: Card } | null> {
  const card = daily?.challenge.slug === attempt.challenge_slug ? daily.challenge : await apiGet(`/v1/challenges/${attempt.challenge_slug}`, challengeCardSchema);
  return card ? { attempt, card } : null;
}
