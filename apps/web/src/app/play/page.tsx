import { dailyResponseSchema, meResponseSchema } from "@greenbuild/shared";
import { apiGet } from "../../server/api";
import { ChallengeCard } from "./_daily/challenge-card";
import { RecentAttempts } from "./_daily/recent-attempts";
import { RightAside } from "./_daily/right-aside";
import { Sidebar } from "./_daily/sidebar";
import { StatusBar } from "./_daily/status-bar";
import { ServiceError } from "./service-error";

export const dynamic = "force-dynamic";

// Figma "Hotfix — Daily Challenge" (1280 × 1024).
export default async function DailyPage() {
  // Today's challenge as the worker published it (task 41c); none yet shows the service error.
  const [daily, player] = await Promise.all([apiGet("/v1/daily", dailyResponseSchema), apiGet("/v1/me", meResponseSchema)]);
  return (
    <div className="min-h-screen bg-canvas">
      {/* The content spans the window up to 1920 px (owner, 2026-10-14); the asides keep their width. */}
      <div className="frame flex">
        <Sidebar streak={player ? player.streak.current : 0} />
        <div className="flex min-w-0 flex-1 justify-between pb-8">
          <main className="flex min-w-0 flex-1 flex-col gap-5 px-3 pt-5">
            <StatusBar player={player} />
            {daily ? <ChallengeCard card={daily.challenge} /> : <ServiceError />}
            <RecentAttempts />
          </main>
          <RightAside />
        </div>
      </div>
    </div>
  );
}
