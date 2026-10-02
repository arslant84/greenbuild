import { challengeCardSchema } from "@greenbuild/shared";
import { apiGet } from "../../server/api";
import { ChallengeCard } from "./_daily/challenge-card";
import { RecentAttempts } from "./_daily/recent-attempts";
import { RightAside } from "./_daily/right-aside";
import { Sidebar } from "./_daily/sidebar";
import { StatusBar } from "./_daily/status-bar";
import { ServiceError } from "./service-error";

// The daily rotation (daily_challenges) arrives in Stage 2; until then today's challenge is nginx-502.
const TODAYS_CHALLENGE = "nginx-502-upstream";

export const dynamic = "force-dynamic";

// Figma "Hotfix — Daily Challenge" (1280 × 1024).
export default async function DailyPage() {
  const card = await apiGet(`/v1/challenges/${TODAYS_CHALLENGE}`, challengeCardSchema);
  return (
    <div className="min-h-screen bg-canvas pl-60">
      <Sidebar />
      <div className="flex w-[1040px] justify-between pb-8">
        <main className="flex w-[760px] flex-col gap-5 px-3 pt-5">
          <StatusBar />
          {card ? <ChallengeCard card={card} /> : <ServiceError />}
          <RecentAttempts />
        </main>
        <RightAside />
      </div>
    </div>
  );
}
