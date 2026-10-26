import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// The canvas colour (globals.css), behind the mark's rounded square.
const BACKGROUND = "#0e0e0f";

// appIcon draws the greenbuild mark (app/icon.svg, the favicon) as a square PNG, so the mark has one source.
export async function appIcon(size: number): Promise<ImageResponse> {
  const svg = await readFile(path.join(process.cwd(), "src", "app", "icon.svg"));
  const source = `data:image/svg+xml;base64,${svg.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: BACKGROUND }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- satori draws plain img elements */}
        <img src={source} width={size} height={size} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
