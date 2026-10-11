import { dailyResponseSchema } from "@greenbuild/shared";
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
  const daily = await apiGet("/v1/daily", dailyResponseSchema);
  return (
    <div className="min-h-screen bg-canvas">
      {/* The 1280 px frame, centered on wider windows (owner, 2026-10-05). */}
      <div className="mx-auto flex w-[1280px]">
        <Sidebar />
        <div className="flex w-[1040px] justify-between pb-8">
          <main className="flex w-[760px] flex-col gap-5 px-3 pt-5">
            <StatusBar />
            {daily ? <ChallengeCard card={daily.challenge} /> : <ServiceError />}
            <RecentAttempts />
          </main>
          <RightAside />
        </div>
      </div>
    </div>
  );
}
