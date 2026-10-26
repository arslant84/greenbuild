import { EnterpriseIcon, ExternalArrowIcon, TickIcon } from "../../ui/icons-landing";

// Figma (Landing) › Section - FOR COMPANIES SECTION, reworded where the frame was not true for
// greenbuild (owner, 2026-10-08): no customer claims, no SOC2, and only the guarantee that holds.
// Team licenses have no page yet, so the button is not a link.
export function ForCompanies() {
  return (
    <section className="pt-8 pb-16">
      <div className="grid grid-cols-1 gap-6 rounded-2xl bg-surface p-5 lg:grid-cols-[minmax(760px,2fr)_1fr] lg:p-8">
        <div className="flex flex-col gap-1.75">
          <span className="flex w-fit flex-wrap items-center gap-1.5 rounded bg-surface-raised px-2.5 py-1 font-mono text-[11px] leading-3.5 font-medium tracking-[0.44px] text-accent-soft">
            <EnterpriseIcon />
            GREENBUILD FOR RECRUITING &amp; ENTERPRISE
          </span>
          <h2 className="text-2xl leading-7.5 font-bold tracking-[-0.6px] text-ink">Hiring infrastructure engineers? Benchmark real skills, not resume keywords.</h2>
          <p className="text-[15px] leading-6 text-ink-muted lg:w-162.5">
            Use greenbuild to run authentic, stress-free terminal assessments. See how candidates read logs, diagnose broken services, and patch them under pressure.
          </p>
          <span className="type-label flex items-center gap-1.5 pt-3.25 text-ink-subtle">
            <TickIcon className="text-ok" />
            100% sandboxed execution
          </span>
        </div>
        <div className="flex flex-col items-start justify-center lg:items-end">
          <span className="flex h-10.5 items-center gap-1 rounded-lg bg-surface-raised px-5 text-[13px] leading-4.5 font-semibold text-ink opacity-60" aria-disabled="true">
            Explore team licenses
            <ExternalArrowIcon />
          </span>
        </div>
      </div>
    </section>
  );
}
