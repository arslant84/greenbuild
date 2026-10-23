import { LightbulbIcon } from "../../../../ui/icons";
import { hintParts } from "./hints";

const DIVIDER = "border-t border-[#3c494c] pt-2";

// Stitch "Hotfix Sandbox — V6 Hint Revealed State" › Diagnostic hints card (task 35c; owner, 2026-10-23:
// missing frames come from Stitch). Opened hints in order; the newest is highlighted.
export function HintsCard({ hints, total }: { hints: string[]; total: number }) {
  if (hints.length === 0) {
    return null;
  }
  return (
    <section aria-label="Diagnostic hints" className="flex max-h-[220px] flex-col gap-2 overflow-y-auto rounded-lg border border-[#3c494c] bg-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-accent">
          <LightbulbIcon />
          <span className="type-label font-semibold tracking-[0.5px] text-accent-soft uppercase">Diagnostic hints</span>
        </span>
        <span className="type-label text-ink-subtle">
          {hints.length} of {total} used
        </span>
      </div>
      <ol className="flex flex-col gap-2">
        {hints.map((hint, index) => (
          <li key={index} className={index > 0 ? DIVIDER : ""}>
            <Hint text={hint} number={index + 1} recent={index === hints.length - 1} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Hint({ text, number, recent }: { text: string; number: number; recent: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 ${recent ? "rounded-r border-l-2 border-accent bg-control py-1 pl-3" : ""}`}>
      <span className={`type-label font-medium tracking-[0.5px] uppercase ${recent ? "text-accent-soft" : "text-warn"}`}>
        {recent ? `Hint ${number} · Recent` : `Hint ${number}`}
      </span>
      <p className="type-body leading-relaxed text-ink">
        {hintParts(text).map((part, index) =>
          part.code ? (
            <code key={index} className="rounded bg-control px-1 py-0.5 font-mono text-[12px] text-accent-soft">
              {part.text}
            </code>
          ) : (
            part.text
          ),
        )}
      </p>
    </div>
  );
}
