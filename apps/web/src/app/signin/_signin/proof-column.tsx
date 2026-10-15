import { ChevronIcon, TerminalIcon } from "../../../ui/icons-signin";

// Figma 7:9957 › right column, engineer states. The terminal is an example of a solve, labelled so;
// feedback and live numbers have no data yet, so they stay empty rather than show the frame's samples.
export function ProofColumn() {
  return (
    <aside className="relative col-span-5 flex min-h-screen flex-col justify-between overflow-hidden border-l border-line bg-surface p-10">
      <span className="pointer-events-none absolute -top-32 -right-32 size-80 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative z-10 flex flex-col gap-6">
        <ExampleTerminal />
        <Feedback />
      </div>
      <LiveTicker />
    </aside>
  );
}

function Feedback() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1 font-mono text-xs text-ink-muted">
        <span className="text-[10px] tracking-wider uppercase">Engineer Feedbacks</span>
        <span className="flex items-center gap-1.5 text-ink-subtle">
          <ChevronIcon direction="left" className="text-sm" />
          <ChevronIcon direction="right" className="text-sm" />
        </span>
      </div>
      <div className="flex min-h-[110px] flex-col justify-between rounded-xl border border-line bg-surface-raised p-4">
        <p className="text-xs leading-relaxed text-ink-subtle">No feedback yet.</p>
        <div className="flex items-center justify-between border-t border-control pt-3 font-mono text-[11px] text-ink-subtle">
          <span>—</span>
          <span>—</span>
        </div>
      </div>
    </div>
  );
}

function LiveTicker() {
  return (
    <div className="relative z-10 mt-6 flex items-center justify-between gap-3 border-t border-line pt-5">
      <div className="flex items-center gap-3">
        <span className="flex -space-x-2">
          {["one", "two", "three"].map((key) => (
            <span key={key} className="size-7 rounded-full border border-line bg-surface-raised" />
          ))}
        </span>
        <span className="text-xs">
          <span className="block font-mono text-[11px] font-medium text-ink">— engineers solved today</span>
          <span className="block text-[10px] text-ink-subtle">—</span>
        </span>
      </div>
      <span className="flex items-center gap-1.5 font-mono text-[11px] text-accent">
        <span className="size-1.5 rounded-full bg-accent" />— solves/hr
      </span>
    </div>
  );
}

function ExampleTerminal() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-canvas shadow-2xl">
      <div className="flex h-9 items-center justify-between border-b border-line bg-surface-raised px-3.5">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#EF4444]/80" />
          <span className="size-2.5 rounded-full bg-[#EAB308]/80" />
          <span className="size-2.5 rounded-full bg-[#22C55E]/80" />
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-muted">
          <TerminalIcon className="text-sm text-ink-subtle" />
          greenbuild-sandbox // example.sh
        </span>
        <span className="rounded border border-ok/40 bg-ok/10 px-1.5 py-0.5 font-mono text-[10px] text-ok">EXAMPLE</span>
      </div>
      <div className="space-y-2 overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-ink-muted">
        <Command text="curl -I http://127.0.0.1/healthz" />
        <div className="text-danger">HTTP/1.1 502 Bad Gateway</div>
        <div className="text-[10px] text-ink-subtle">[WARN] upstream connect error or disconnect/reset before headers</div>
        <Command text="ss -ltnp | grep 8080" />
        <div className="text-[10px] text-ink-muted">LISTEN 0 511 [::1]:8080 users:((&quot;node&quot;,pid=1042))</div>
        <Command text="nginx -t && nginx -s reload" />
        <div className="text-[10px] text-ink-muted">nginx: configuration file /etc/nginx/nginx.conf test is successful</div>
        <div className="flex items-center justify-between pt-1 text-[10px] font-semibold text-accent-soft">
          <span>[SOLVED] the check passes</span>
        </div>
      </div>
    </div>
  );
}

function Command({ text }: { text: string }) {
  return (
    <div className="pt-1 first:pt-0">
      <span className="font-semibold text-accent">$</span> <span className="text-ink">{text}</span>
    </div>
  );
}
