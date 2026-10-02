import { AlertIcon, LockIcon } from "../../../../../ui/icons";

// Figma V4 › AMBER ALERT BOX.
export function AmberAlert({ children }: { children: string }) {
  return (
    <div className="flex gap-1 rounded-lg bg-[#e3aa0033] p-2 text-warn">
      <AlertIcon className="mt-0.5 shrink-0" />
      <p className="font-mono text-[10px] leading-[14px] tracking-[0.2px]">{children}</p>
    </div>
  );
}

// Figma V4 › RECENT DIAGNOSTIC SNAPSHOT, filled with what the checker printed.
export function CheckerOutput({ output }: { output: string }) {
  const lines = output.split("\n").filter((line) => line.trim() !== "");
  return (
    <section className="flex flex-col gap-1 rounded-lg bg-surface p-3">
      <span className="type-label tracking-[0.5px] text-ink-subtle uppercase">Checker output</span>
      {lines.length === 0 && <span className="type-label text-ink-muted">—</span>}
      {lines.map((line, index) => (
        <span key={index} className="type-label break-words text-ink">
          {line}
        </span>
      ))}
    </section>
  );
}

// Figma V5 › Telemetry Network Disruption Informational Card. The frame promises a paused timer;
// the sandbox's time limit runs on the server, so the card says what really happens.
export function DisconnectedCard() {
  return (
    <section className="flex flex-col gap-2 rounded-lg bg-surface p-3 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]">
      <span className="flex items-center gap-2 text-warn">
        <LockIcon />
        <span className="font-mono text-[13px] leading-[18px] font-semibold tracking-[-0.32px]">Sandbox Still Running</span>
      </span>
      <p className="type-body text-ink">
        Network disruption detected. Your sandbox and its changes are kept while we reconnect; the timer keeps running and no checks are used.
      </p>
      <span className="flex items-center justify-between pt-1">
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-warn" />
          <span className="type-label text-ink-muted">State: reconnecting</span>
        </span>
        <span className="type-label text-ok">No checks used</span>
      </span>
    </section>
  );
}
