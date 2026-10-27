import Image from "next/image";

const SIZE_PX = 20;

// The greenbuild mark, from the owner's Stitch screen "Greenbuild Logo": a passing prompt, a G and a green
// build dot. It is the favicon (app/icon.svg, which Next serves at /icon.svg) and sits before the wordmark
// (owner, 2026-10-23).
export function LogoMark() {
  return <Image src="/icon.svg" alt="" width={SIZE_PX} height={SIZE_PX} unoptimized className="shrink-0" />;
}
