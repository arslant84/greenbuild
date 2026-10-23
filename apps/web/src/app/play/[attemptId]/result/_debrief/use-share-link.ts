"use client";

import { shareCreatedSchema } from "@greenbuild/shared";
import { useCallback, useState } from "react";

// useShareLink makes the solved attempt's public link on first use (task 51) and keeps it for the page;
// asking again answers the same link, so a reload loses nothing.
function useShareLink(attemptId: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const link = useCallback(async (): Promise<string | null> => {
    if (url) {
      return url;
    }
    const response = await fetch(`/api/attempts/${attemptId}/share`, { method: "POST", headers: { "x-greenbuild-request": "1" } }).catch(() => null);
    const created = response?.ok ? shareCreatedSchema.safeParse(await response.json()) : null;
    setFailed(!created?.success);
    const made = created?.success ? `${window.location.origin}/s/${created.data.token}` : null;
    setUrl(made);
    return made;
  }, [attemptId, url]);
  return { link, failed };
}

// useShareActions: copy the link, share it (the share sheet where the browser has one, else a copy), or
// download the card's PNG.
export function useShareActions(attemptId: string) {
  const { link, failed } = useShareLink(attemptId);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = await link();
    if (url) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    }
  };
  const share = async () => {
    const url = await link();
    if (url && typeof navigator.share === "function") {
      // Closing the share sheet rejects; that is the player's choice, not an error.
      await navigator.share({ url }).catch(() => undefined);
    } else if (url) {
      await copy();
    }
  };
  const download = async () => {
    const url = await link();
    if (url) {
      Object.assign(document.createElement("a"), { href: `${url}/image.png`, download: "greenbuild-result.png" }).click();
    }
  };
  return { copy, share, download, copied, failed };
}
