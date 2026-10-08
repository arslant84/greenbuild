import Link from "next/link";
import { ArrowRightIcon, LinkOffIcon } from "../ui/icons-errors";

// Figma "Global Error, Edge States & Resilience Console" › E1: 404 Not Found.
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#131314]">
      <section className="flex w-[392px] flex-col gap-[26px] rounded-xl border border-control bg-surface p-5 shadow-[0_8px_10px_-6px_rgba(0,0,0,0.1),0_20px_25px_-5px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between">
          <span className="type-label text-ink-muted">STATE // 404_PAGE_NOT_FOUND</span>
          <span className="rounded bg-control px-1.5 py-0.5 font-mono text-[11px] leading-[14px] font-medium tracking-[0.44px] text-ink-muted">HTTP 404</span>
        </div>
        <div className="flex flex-col items-center text-center">
          <span className="mb-3 flex size-12 items-center justify-center rounded-xl bg-control text-accent">
            <LinkOffIcon />
          </span>
          <h1 className="pb-1 text-lg leading-6 font-semibold tracking-[-0.18px] text-ink">Page not found</h1>
          <p className="type-body w-[280px] text-ink-muted">This page doesn&apos;t exist or was relocated during an infrastructure migration.</p>
        </div>
        <div className="flex flex-col gap-1">
          <Link href="/play" className="type-body flex h-[34px] items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 font-semibold text-[#00363e]">
            Go to today&apos;s challenge
            <ArrowRightIcon />
          </Link>
          <Link href="/" className="type-body flex h-[34px] items-center justify-center rounded-lg px-3 py-2 text-ink-muted">
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
