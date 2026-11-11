import Link from "next/link";
import { LogoMark } from "./logo-mark";

// The one greenbuild brand for every header: the mark and ">_ greenbuild" in mono, linking home. The landing
// sends a signed-in player on to their Daily screen (owner, 2026-10-27; architecture.md, deviation 35).
export function Brand() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 font-mono text-[13px] leading-[18px] font-semibold tracking-[-0.32px] text-accent-soft">
      <LogoMark />
      &gt;_ greenbuild
    </Link>
  );
}
