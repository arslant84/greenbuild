import { redirect } from "next/navigation";
import { authInstance } from "../server/auth";
import { ForCompanies } from "./_landing/for-companies";
import { Hero } from "./_landing/hero";
import { LandingFooter, LandingHeader } from "./_landing/landing-chrome";
import { HowItWorks } from "./_landing/how-it-works";
import { LeaderboardPreview } from "./_landing/leaderboard-preview";
import { MetricsStrip } from "./_landing/metrics-strip";
import { SampleScenario } from "./_landing/sample-scenario";

// Figma "Hotfix — Daily DevOps Troubleshooting Game" (3:411): the public landing page. Below 1024 px the
// Stitch phone screen "Greenbuild — Daily DevOps Troubleshooting Game (Phone)" (task 56). The brand links
// here from every screen, so a signed-in player goes on to their Daily screen (deviation 35).
export default async function LandingPage() {
  if ((await authInstance()?.auth())?.user) {
    redirect("/play");
  }
  return (
    <div data-responsive className="min-h-screen bg-[#131314] lg:min-w-[1280px]">
      <LandingHeader />
      {/* The content and its header and footer bars span the whole window (owner, 2026-10-14). */}
      <main className="frame px-4 lg:px-8">
        <Hero />
        <MetricsStrip />
        <HowItWorks />
        <SampleScenario />
        <LeaderboardPreview />
        <ForCompanies />
      </main>
      <LandingFooter />
    </div>
  );
}
