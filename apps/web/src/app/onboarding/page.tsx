import Link from "next/link";
import { AFTER_ONBOARDING, ContinueButton } from "./continue-button";
import { TerminalPreview, ValueProps } from "./welcome-parts";
import { LogoMark } from "../../ui/logo-mark";

const STEPS = 3;

// Figma "Hotfix — First-Time User Onboarding (3-Step Flow)" (7:10146), step 1: Welcome. The frame's
// state simulator bar is a design control and is not built. Below 1024 px the Stitch phone screen "Greenbuild —
// Onboarding Welcome (Phone)": the card fills the screen, the terminal goes under the value props and
// "Let's go" comes last (task 56).
export default function OnboardingPage() {
  return (
    <main data-responsive className="relative flex min-h-screen justify-center overflow-hidden bg-[#131314] lg:min-w-[1280px] lg:items-center lg:px-6">
      <span className="pointer-events-none absolute size-[480px] w-[640px] rounded-full bg-[#8aebff0d] blur-3xl" />
      <section className="relative w-full overflow-hidden bg-surface lg:w-[880px] lg:rounded-xl shadow-[0_8px_10px_-6px_rgba(0,0,0,0.1),0_20px_25px_-5px_rgba(0,0,0,0.1)]">
        <header className="flex h-11 items-center justify-between gap-3 bg-surface-raised px-4 lg:px-5">
          <span className="flex items-center gap-1.5 font-mono text-[13px] leading-[18px] font-medium tracking-[-0.32px]">
            <LogoMark />
            <span className="text-warn">&gt;_</span>
            <span className="text-ink">greenbuild</span>
            <span className="hidden text-xs leading-4 text-ink-subtle sm:inline">:: onboarding</span>
          </span>
          <StepDots current={1} />
          <Link href={AFTER_ONBOARDING} className="type-label text-ink-subtle">
            Skip intro
          </Link>
        </header>
        <div className="px-4 py-6 lg:px-8 lg:py-[49px]">
          <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.8px] text-ink lg:text-[32px] lg:leading-10">Welcome to greenbuild.</h1>
          <p className="pt-1 pb-5 text-[15px] leading-[22px] text-ink-muted">You&apos;ll fix one broken production incident per day. 5–15 minutes. Free forever.</p>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[468px_1fr]">
            <div className="flex flex-col justify-between max-lg:contents">
              <ValueProps />
              <ContinueButton />
            </div>
            <TerminalPreview />
          </div>
        </div>
      </section>
    </main>
  );
}

// Figma › Center: 3-step Minimal Dots Indicator.
function StepDots({ current }: { current: number }) {
  return (
    <span className="flex items-center gap-2" aria-label={`Step ${current} of ${STEPS}`}>
      {Array.from({ length: STEPS }, (_, index) => (
        <span key={index} className="flex items-center gap-2">
          {index > 0 && <span className="h-0.5 w-6 bg-line" />}
          <span className={`size-2.5 rounded-full ${index + 1 === current ? "bg-accent shadow-[0_0_8px_rgba(34,211,238,0.6)]" : "bg-line"}`} />
        </span>
      ))}
    </span>
  );
}
