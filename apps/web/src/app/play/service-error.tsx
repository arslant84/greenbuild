import { RefreshIcon, WarningIcon } from "../../ui/icons";

// Figma "Global Error, Edge States & Resilience Console" › E2: 500 Server Error.
// retryHref reloads the screen that failed.
export function ServiceError({ retryHref = "/play" }: { retryHref?: string }) {
  return (
    <section className="mx-auto flex w-[392px] flex-col rounded-xl border border-control bg-surface p-5 shadow-[0_8px_10px_-6px_rgba(0,0,0,0.1),0_20px_25px_-5px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-between">
        <span className="type-label text-danger">STATE // 500_SEV1_INTERNAL</span>
        <span className="rounded bg-[#93000a4d] px-1.5 py-0.5 font-mono text-[11px] leading-[14px] font-medium tracking-[0.44px] text-danger">
          SEV-1 ALERT
        </span>
      </div>
      <div className="flex flex-col items-center py-3 text-center">
        <span className="mb-3 flex size-12 items-center justify-center rounded-xl bg-[#93000a33] text-danger">
          <WarningIcon />
        </span>
        <h2 className="pb-1 text-lg leading-6 font-semibold tracking-[-0.18px] text-ink">Something broke on our end</h2>
        <p className="type-body px-[5px] text-ink-muted">The challenge could not be loaded. Try again in a moment.</p>
      </div>
      <div className="flex flex-col gap-1 pt-3">
        <a href={retryHref} className="type-body flex h-[34px] items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 font-semibold text-[#00363e]">
          <RefreshIcon width={11} height={11} />
          Retry
        </a>
      </div>
    </section>
  );
}
