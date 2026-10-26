import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "../../ui/logo-mark";

// The beta terms and privacy pages (task 31a; architecture.md, deviation 30): no Figma frame, plain text on
// the app's tokens, replaced by the lawyer's texts before the public launch (task 60). On a phone it is one
// narrower column (task 56).
export function LegalPage({ title, version, children }: { title: string; version: string; children: ReactNode }) {
  return (
    <main data-responsive className="min-h-screen bg-canvas text-ink lg:min-w-[1280px]">
      <header className="flex h-14 items-center border-b border-line px-4 lg:px-16">
        <Link href="/" className="inline-flex items-center gap-2 font-mono text-sm tracking-tight text-ink">
          <LogoMark />
          <span className="font-bold text-accent">&gt;_</span>
          <span className="font-semibold tracking-wide">greenbuild</span>
        </Link>
      </header>
      <article className="mx-auto flex max-w-[720px] flex-col gap-6 px-4 py-8 text-[15px] leading-[22px] text-ink-muted lg:px-6 lg:py-12">
        <p role="note" className="rounded-lg border border-warn/40 bg-warn/10 p-4 text-sm text-warn">
          Beta. This text is a short placeholder written before the lawyer&apos;s review; it will be replaced before greenbuild&apos;s public launch, and you will be asked to accept the new version.
        </p>
        <div>
          <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.8px] text-ink lg:text-[32px] lg:leading-10">{title}</h1>
          <p className="pt-1 font-mono text-xs text-ink-subtle">Version {version}</p>
        </div>
        {children}
      </article>
    </main>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-ink">{heading}</h2>
      {children}
    </section>
  );
}
