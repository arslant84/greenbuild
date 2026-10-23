import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowForwardIcon } from "../../../ui/icons";
import { ShareCard } from "./share-card";
import { loadShareCard, requestOrigin } from "./share-data";
import { shareView } from "./share-view";

export const dynamic = "force-dynamic";

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;

interface SharePageProps {
  params: Promise<{ token: string }>;
}

// Link previews (LinkedIn, X, Telegram) read these tags; the image is the card as a PNG (task 51).
export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { token } = await params;
  const card = await loadShareCard(token);
  if (!card) {
    return { title: "greenbuild" };
  }
  const view = shareView(card);
  const title = `${view.name} solved “${view.title}” · greenbuild`;
  const image = { url: `${await requestOrigin()}/s/${token}/image.png`, width: IMAGE_WIDTH, height: IMAGE_HEIGHT, alt: view.summary };
  return { title, description: view.summary, openGraph: { title, description: view.summary, images: [image] }, twitter: { card: "summary_large_image", title, description: view.summary, images: [image.url] } };
}

// /s/{token}: Stitch "Greenbuild — Public Shared Result" (owner, 2026-10-23: missing frames come from Stitch).
// Anyone with the link sees it; a revoked or unknown link is not found.
export default async function SharePage({ params }: SharePageProps) {
  const card = await loadShareCard((await params).token);
  if (!card) {
    notFound();
  }
  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0c]">
      <header className="border-b border-line/60">
        <div className="mx-auto flex h-14 max-w-[720px] items-center justify-between px-4">
          <span className="font-mono text-sm font-semibold tracking-[-0.3px] text-white">&gt;_ greenbuild</span>
          <Link href="/signin" className="font-mono text-[13px] text-ink-muted hover:text-white">
            Sign in
          </Link>
        </div>
      </header>
      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-16">
        <span className="pointer-events-none absolute top-1/2 left-1/2 h-[440px] w-[600px] -translate-1/2 rounded-full bg-[linear-gradient(45deg,rgba(100,248,138,0.15),rgba(34,211,238,0.15),transparent)] blur-3xl" />
        <div className="relative flex w-full max-w-[720px] flex-col items-center gap-5">
          <ShareCard view={shareView(card)} passed={card.checks_passed} used={card.checks_used} />
          <p className="max-w-[460px] text-center text-[15px] leading-6 text-ink-muted">A production incident, fixed in a real Linux sandbox and verified by an automated check.</p>
          <Link href="/play" className="flex h-11 items-center gap-2 rounded-lg bg-accent px-5 font-mono text-[15px] font-semibold text-on-accent shadow-[0_8px_24px_-4px_rgba(34,211,238,0.35)]">
            Try today&apos;s challenge
            <ArrowForwardIcon />
          </Link>
          <Link href="/challenges" className="font-mono text-[15px] text-ink-subtle hover:text-ink">
            Browse the catalog
          </Link>
        </div>
      </main>
    </div>
  );
}
