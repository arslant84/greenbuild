"use client";

import { DownloadIcon, LinkIcon, ShareIcon } from "../../../../../ui/icons-debrief";
import { useShareActions } from "./use-share-link";

const BUTTON = "flex h-11 flex-1 items-center justify-center gap-2 rounded-lg disabled:cursor-not-allowed disabled:opacity-60";

// Figma › the credential's actions (task 51): share the public link, download the card as a PNG, or copy the
// link. Only a solved attempt has a link.
export function ShareActions({ attemptId, solved }: { attemptId: string; solved: boolean }) {
  const { copy, share, download, copied, failed } = useShareActions(attemptId);
  return (
    <div className="flex flex-col gap-1 pt-1">
      <div className="flex gap-1">
        <button type="button" disabled={!solved} onClick={() => void share()} className={`${BUTTON} bg-accent text-[#00363e]`}>
          <ShareIcon />
          <span className="type-body font-semibold">Share result</span>
        </button>
        <button type="button" disabled={!solved} onClick={() => void download()} className={`${BUTTON} bg-surface-raised text-ink`}>
          <DownloadIcon />
          <span className="type-body font-medium">Download PNG</span>
        </button>
        <button type="button" disabled={!solved} onClick={() => void copy()} className={`${BUTTON} bg-surface-raised text-ink-muted`}>
          <LinkIcon />
          <span className="type-body font-medium">{copied ? "Link copied" : "Copy verification link"}</span>
        </button>
      </div>
      {failed && (
        <p role="alert" className="type-label text-danger">
          The share link could not be made. Try again in a moment.
        </p>
      )}
    </div>
  );
}
