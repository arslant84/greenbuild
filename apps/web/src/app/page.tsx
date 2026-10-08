import { Hero } from "./_landing/hero";
import { LandingFooter, LandingHeader } from "./_landing/landing-chrome";
import { MetricsStrip } from "./_landing/metrics-strip";

// Figma "Hotfix — Daily DevOps Troubleshooting Game" (3:411): the public landing page.
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#131314]">
      {/* The 1280 px frame, centered on wider windows (owner, 2026-10-05). */}
      <div className="mx-auto w-[1280px]">
        <LandingHeader />
        <main className="px-8">
          <Hero />
          <MetricsStrip />
        </main>
        <LandingFooter />
      </div>
    </div>
  );
}
