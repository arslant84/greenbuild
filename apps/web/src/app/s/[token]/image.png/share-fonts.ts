import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ImageResponse } from "next/og";

type Font = NonNullable<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]>[number];

// The app's fonts as static WOFF files (@fontsource): satori cannot read the WOFF2 the app uses (owner,
// 2026-10-23). Read once per server.
const FONTS: { name: string; file: string; weight: NonNullable<Font["weight"]> }[] = [
  { name: "Inter", file: "inter/files/inter-latin-400-normal.woff", weight: 400 },
  { name: "Inter", file: "inter/files/inter-latin-600-normal.woff", weight: 600 },
  { name: "Inter", file: "inter/files/inter-latin-700-normal.woff", weight: 700 },
  { name: "JetBrains Mono", file: "jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff", weight: 400 },
  { name: "JetBrains Mono", file: "jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff", weight: 600 },
  { name: "JetBrains Mono", file: "jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff", weight: 700 },
];

let loaded: Promise<Font[]> | undefined;

export function shareFonts(): Promise<Font[]> {
  const fonts = loaded ?? Promise.all(FONTS.map(async ({ name, file, weight }): Promise<Font> => ({ name, weight, style: "normal", data: await readFile(path.join(process.cwd(), "node_modules", "@fontsource", file)) })));
  loaded = fonts;
  return fonts;
}
