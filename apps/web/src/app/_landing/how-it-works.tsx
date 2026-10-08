import type { ReactNode } from "react";
import { BootIcon, CalibratedIcon, PickScenarioIcon, RewardIcon, SandboxChipIcon, TrophyIcon } from "../../ui/icons-landing";

// Figma's three steps, reworded where the frame was not true for greenbuild (owner, 2026-10-08): the
// topics are the catalog's, sandboxes start in seconds, ratings are Glicko-2, and there is no XP yet.
const STEPS: { icon: ReactNode; title: string; text: string; note: ReactNode; noteColor: string }[] = [
  {
    icon: <PickScenarioIcon className="text-accent-soft" />,
    title: "1. Pick a scenario",
    text: "Choose from nginx and TLS failures, PostgreSQL and Redis misconfigurations, file permissions, stuck ports and resource limits.",
    note: (
      <>
        <CalibratedIcon /> Verified by automated break-and-fix checks
      </>
    ),
    noteColor: "text-ink-subtle",
  },
  {
    icon: <SandboxChipIcon className="text-accent-soft" />,
    title: "2. Fix it in the sandbox",
    text: "Get an isolated Linux sandbox in seconds. Read the logs, grep the configs, restart services, and run the check when you think it is fixed.",
    note: (
      <>
        <BootIcon /> gVisor isolation, no network
      </>
    ),
    noteColor: "text-ink-subtle",
  },
  {
    icon: <TrophyIcon className="text-warn" />,
    title: "3. Earn a verifiable rating",
    text: "Keep your daily streak, climb the Glicko-2 rating, and build a profile that engineering teams can verify.",
    note: (
      <>
        <RewardIcon /> Rated after every solve
      </>
    ),
    noteColor: "text-warn",
  },
];

// Figma (Landing) › Section - HOW IT WORKS SECTION.
export function HowItWorks() {
  return (
    <section id="how-it-works" className="flex flex-col gap-5 py-8">
      <div className="flex flex-col gap-[5px] pt-[3px]">
        <span className="font-mono text-[11px] leading-[14px] font-semibold tracking-[1.1px] text-accent-soft uppercase">How it works</span>
        <h2 className="text-2xl leading-[30px] font-bold tracking-[-0.6px] text-ink">From incident alert to green build in 15 minutes</h2>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {STEPS.map((step) => (
          <article key={step.title} className="flex h-[223px] flex-col justify-between rounded-xl bg-surface p-5">
            <div className="flex flex-col">
              <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-surface-raised">{step.icon}</span>
              <h3 className="pb-[3px] text-lg leading-6 font-semibold tracking-[-0.18px] text-ink">{step.title}</h3>
              <p className="text-[13px] leading-[21px] text-ink-muted">{step.text}</p>
            </div>
            <span className={`type-label flex items-center gap-1.5 ${step.noteColor}`}>{step.note}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
