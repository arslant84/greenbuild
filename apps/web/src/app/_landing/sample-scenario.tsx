import { ChecksPassedIcon, PatchedIcon } from "../../ui/icons-landing";

// A real catalog challenge, app-open-files ("Too many customers"), in place of the frame's invented
// Kubernetes incident: its fix is one line of the app's environment file, and its check's own message.
// The file holds this one line; the server opens one access log per customer, and there are 40+ now.
const REMOVED = { line: 1, text: "- LIMIT_NOFILE=32" };
const ADDED = { line: 1, text: "+ LIMIT_NOFILE=4096" };

// Figma (Landing) › Section - SAMPLE CHALLENGE PREVIEW.
export function SampleScenario() {
  return (
    <section className="flex flex-col gap-5 py-8">
      <ScenarioHeading />
      <div className="overflow-hidden rounded-xl bg-canvas shadow-[0_8px_10px_-6px_rgba(0,0,0,0.1),0_20px_25px_-5px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between bg-surface-raised px-3 py-2.5">
          <span className="type-label flex items-center gap-1.5 text-ink">
            <PatchedIcon className="text-ok" />
            /etc/media/media.env patched
          </span>
          <span className="type-label rounded bg-surface px-2 py-0.5 text-ink-muted">Target: media.env</span>
        </div>
        <div className="flex flex-col gap-5 p-5">
          <div className="flex flex-col gap-1 pl-17.75 font-mono text-[13px] leading-4.5">
            <DiffRow line={REMOVED.line} text={REMOVED.text} look="rounded bg-[#93000a33] text-danger" />
            <DiffRow line={ADDED.line} text={ADDED.text} look="rounded bg-[#64f88a1a] font-semibold text-ok" />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-surface p-3">
            <span className="flex items-center gap-2 font-mono text-[13px] leading-4.5 text-ok">
              <ChecksPassedIcon />
              Check PASSED: the app is back.
            </span>
            <span className="type-label rounded bg-surface-raised px-2.5 py-1 text-warn">Score: —</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function DiffRow({ line, text, look }: { line: number; text: string; look: string }) {
  return (
    <span className="flex gap-3">
      <span className="w-4 shrink-0 text-right text-ink-subtle">{line}</span>
      <span className={`flex-1 px-1 ${look}`}>{text}</span>
    </span>
  );
}

function ScenarioHeading() {
  return (
    <div className="flex items-end justify-between">
      <div className="flex flex-col gap-1.25">
        <span className="font-mono text-[11px] leading-3.5 font-semibold tracking-[1.1px] text-warn uppercase">Sample scenario preview</span>
        <h2 className="text-2xl leading-7.5 font-bold tracking-[-0.6px] text-ink">Too many customers</h2>
      </div>
      <span className="flex gap-2 font-mono text-[11px] leading-3.5 font-medium tracking-[0.44px]">
        <span className="rounded bg-surface-raised px-2 py-1 text-ink-subtle">Difficulty: 4/10</span>
        <span className="rounded bg-surface-raised px-2 py-1 text-warn">Linux</span>
        <span className="rounded bg-surface-raised px-2 py-1 text-ok">nginx</span>
      </span>
    </div>
  );
}
