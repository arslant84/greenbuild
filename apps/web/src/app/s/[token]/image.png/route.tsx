import { ImageResponse } from "next/og";
import { loadShareCard } from "../share-data";
import { shareView } from "../share-view";
import { ShareImage } from "./share-image";
import { shareFonts } from "./share-fonts";

export const dynamic = "force-dynamic";

const WIDTH = 1200;
const HEIGHT = 630;
// Link previews fetch the image once; a short cache keeps a revoked link's image from living long.
const CACHE = "public, max-age=300";

// GET /s/{token}/image.png: the share card as a 1200×630 PNG for link previews and "Download PNG" (task 51).
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const card = await loadShareCard((await params).token);
  if (!card) {
    return new Response("Not found", { status: 404 });
  }
  return new ImageResponse(<ShareImage view={shareView(card)} passed={card.checks_passed} used={card.checks_used} />, {
    width: WIDTH,
    height: HEIGHT,
    fonts: await shareFonts(),
    headers: { "cache-control": CACHE },
  });
}
