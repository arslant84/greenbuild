"use client";

import { useSubmitShortcut } from "../../../ui/use-shortcut";
import { useStartAttempt } from "./use-start-attempt";

const READY = "bg-accent text-on-accent shadow-[0_4px_6px_-4px_rgba(8,51,69,0.5),0_10px_15px_-3px_rgba(8,51,69,0.5)] disabled:opacity-70";
const BLOCKED = "cursor-not-allowed border border-accent/30 bg-accent/20 text-accent opacity-40";

// Figma › Big CTA Button; while another attempt runs, Stitch "Daily Challenge (Attempt In Progress)"
// shows it disabled with a note, and the shortcut resumes the running attempt instead (task 21b).
export function StartButton({ challengeSlug, blocked }: { challengeSlug: string; blocked: boolean }) {
  const { start, starting, error } = useStartAttempt(challengeSlug);
  useSubmitShortcut(() => void start(), !starting && !blocked);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void start()}
        disabled={starting || blocked}
        className={`flex h-14 items-center justify-center gap-2 rounded-lg ${blocked ? BLOCKED : READY}`}
      >
        <span className="font-mono text-[13px] leading-[18px] font-semibold tracking-[-0.32px]">&gt;_</span>
        <span className="text-[15px] leading-[22px] font-bold">{starting ? "Starting…" : "Start Challenge"}</span>
        <span className="type-label ml-2 rounded bg-black/20 px-1.5 py-0.5">⌘ + ↵</span>
      </button>
      {blocked && <p className="type-label -mt-1 text-center text-ink-muted">Finish or give up your running attempt to start another.</p>}
      {error && (
        <p role="alert" className="type-label text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
