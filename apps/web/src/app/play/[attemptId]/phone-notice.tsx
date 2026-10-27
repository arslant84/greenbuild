"use client";

import type { ChallengeCard } from "@greenbuild/shared";
import Link from "next/link";
import type { SVGProps } from "react";
import { formatClock } from "../../../ui/format";
import { ArrowBackIcon } from "../../../ui/icons";
import { LogoMark } from "../../../ui/logo-mark";
import { useNow } from "../../../ui/use-now";

const MS_PER_SECOND = 1_000;

// Stitch "Greenbuild — Sandbox on a Phone (Notice)": below 768 px the sandbox is not shown (owner,
// 2026-10-26, task 56). The attempt keeps running, and the player continues on a computer or tablet.
export function PhoneNotice({ card, startedAt }: { card: ChallengeCard; startedAt: string }) {
  const elapsed = (useNow() - Date.parse(startedAt)) / MS_PER_SECOND;
  return (
    <div className="flex min-h-screen flex-col bg-canvas md:hidden">
      <header className="flex h-14 items-center justify-between border-b border-[#3c494c4d] px-4">
        <span className="flex items-center gap-2 font-mono text-[13px] leading-[18px] font-semibold text-ink">
          <LogoMark />
          greenbuild
          <span className="font-normal text-ink-subtle">/ sandbox</span>
        </span>
        <span className="rounded-full border border-ok/40 px-2 py-0.5 type-label text-ok">RUNNING</span>
      </header>
      <main className="flex flex-1 flex-col justify-center gap-3 px-4 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="type-body font-medium text-ink">{card.title}</span>
          <span className="rounded bg-[#e3aa0026] px-1.5 py-0.5 type-label text-warn">{card.difficulty}/10</span>
          <span className="rounded bg-control px-1.5 py-0.5 type-label text-ok">{formatClock(elapsed)}</span>
        </div>
        <section className="flex flex-col items-center gap-3 rounded-xl bg-surface p-5 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-control text-ok">
            <DesktopIcon />
          </span>
          <h1 className="text-lg leading-6 font-semibold text-ink">Best on a computer or tablet</h1>
          <p className="type-body text-ink-muted">The sandbox needs a keyboard and a wide screen. Your attempt keeps running; open this page on a computer or tablet to continue.</p>
          <Link href="/play" className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent type-body font-semibold text-[#00363e]">
            <ArrowBackIcon />
            Back to Daily
          </Link>
        </section>
      </main>
    </div>
  );
}

// Material Symbols "computer", as the Stitch screen draws it.
function DesktopIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={22} height={22} viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M40-120v-80h880v80H40Zm120-120q-33 0-56.5-23.5T80-320v-440q0-33 23.5-56.5T160-840h640q33 0 56.5 23.5T880-760v440q0 33-23.5 56.5T800-240H160Zm0-80h640v-440H160v440Zm0 0v-440 440Z" />
    </svg>
  );
}
