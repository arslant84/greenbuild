import { ForCompanies } from "./_landing/for-companies";
import { Hero } from "./_landing/hero";
import { LandingFooter, LandingHeader } from "./_landing/landing-chrome";
import { HowItWorks } from "./_landing/how-it-works";
import { LeaderboardPreview } from "./_landing/leaderboard-preview";
import { MetricsStrip } from "./_landing/metrics-strip";
import { SampleScenario } from "./_landing/sample-scenario";

// Figma "Hotfix — Daily DevOps Troubleshooting Game" (3:411): the public landing page.
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#131314]">
      <LandingHeader />
      {/* The content spans the window up to 1920 px, centered; the header and footer bars span it all (owner, 2026-10-14). */}
      <main className="frame px-8">
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
