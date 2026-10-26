import Link from "next/link";
import type { ReactNode } from "react";
import { PersonIcon } from "../../../../../ui/icons";
import { type Outcome, TONE_BG, TONE_TEXT } from "./outcome";
import { LogoMark } from "../../../../../ui/logo-mark";

interface DebriefFrameProps {
  incident: string;
  outcome: Outcome;
  children: ReactNode;
}

// Figma "Incident Debrief & Verifiable Credential" (3:1462): 56 px blurred header, 688 px column, footer.
export function DebriefFrame({ incident, outcome, children }: DebriefFrameProps) {
  return (
    // Below 1024 px the Stitch phone screen "Greenbuild — Incident Debrief (Phone)" (task 56).
    <div data-responsive className="min-h-screen bg-canvas lg:min-w-[1280px]">
      <header className="sticky top-0 z-10 bg-[#131314cc] shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md lg:px-[max(280px,calc(50%-360px))]">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="flex items-center gap-3">
            <Link href="/play" className="flex items-center gap-2 font-mono text-[13px] leading-[18px] font-semibold tracking-[-0.32px] text-accent-soft">
              <LogoMark />
              &gt;_ greenbuild
            </Link>
            <span className="type-label text-[#3c494c]">/</span>
            <span className="rounded bg-control px-1 py-0.5 font-mono text-[11px] leading-[14px] font-medium tracking-[0.44px] text-ink-muted">#{incident}</span>
          </span>
          <nav className="hidden items-center gap-2 lg:flex">
            <span className="type-body rounded bg-control px-2 py-1 font-medium text-ink">Debrief</span>
            <span className="rounded px-2 py-1 font-mono text-[13px] leading-[18px] text-ink-muted" aria-disabled="true">Credential</span>
          </nav>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className={`size-1.5 rounded-full ${TONE_BG[outcome.tone]}`} />
              <span className={`type-label ${TONE_TEXT[outcome.tone]}`}>{outcome.headerStatus}</span>
            </span>
            <span className="hidden size-8 items-center justify-center rounded-full bg-accent-soft text-[#00363e] lg:flex">
              <PersonIcon />
            </span>
          </span>
        </div>
      </header>
      <main className="mx-auto w-full px-4 pt-6 pb-8 lg:w-[688px] lg:px-0 lg:pt-8">{children}</main>
      <footer className="py-5 lg:px-[max(280px,calc(50%-360px))]">
        <div className="flex flex-col gap-1 px-4 lg:flex-row lg:justify-between">
          <span className="type-label text-ink-muted">&gt;_ GREENBUILD RECOVERY ENGINE // VERIFIED PROTOCOL</span>
          <span className="type-label text-ink-muted">NODE ID: —</span>
        </div>
      </footer>
    </div>
  );
}
