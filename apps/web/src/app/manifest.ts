import type { MetadataRoute } from "next";
import { APP_ICON_SIZES } from "./app-icon/sizes";

// The web app manifest makes greenbuild installable (task 56). No service worker: a sandbox needs the
// network anyway, so offline pages would add little (owner, 2026-10-26; architecture.md, deviation 34).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "greenbuild",
    short_name: "greenbuild",
    description: "Daily DevOps challenges that turn proven skill into a public certificate.",
    start_url: "/play",
    display: "standalone",
    background_color: "#0e0e0f",
    theme_color: "#0e0e0f",
    icons: APP_ICON_SIZES.map((size) => ({ src: `/app-icon/${size}`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" })),
  };
}
