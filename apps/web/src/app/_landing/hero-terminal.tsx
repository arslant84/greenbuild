const PROMPT = "player@sandbox:~$ ";

// The frame's terminal shows an invented payment-service incident; this one shows the real daily
// challenge (nginx answering 502) in the sandbox's own terms: no systemd, no Docker inside.
const STEPS: { command: string; output: string; color: string }[] = [
  { command: "curl -I http://localhost/", output: "HTTP/1.1 502 Bad Gateway\ncontent-type: text/html | server: nginx", color: "text-danger" },
  {
    command: "tail -n 1 /var/log/nginx/error.log",
    output: '[error] connect() failed (111: Connection refused) while\nconnecting to upstream: "http://127.0.0.1:3417/"',
    color: "text-danger",
  },
  { command: "ss -ltn | grep 3417", output: "(nothing is listening on 3417)", color: "text-warn" },
];

// Figma (Landing) › Right Column: Interactive Terminal Viewport (an illustration, not a live session).
export function HeroTerminal() {
  return (
    <div className="flex h-99 flex-col overflow-hidden rounded-xl bg-canvas shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]" aria-hidden="true">
      <TitleBar />
      <div className="flex flex-1 flex-col justify-between p-5 font-mono text-[13px] leading-5.25">
        <div className="flex flex-col gap-2">
          {STEPS.map((step) => (
            <div key={step.command}>
              <span className="font-semibold text-ok">{PROMPT}</span>
              <span className="text-ink">{step.command}</span>
              <p className={`whitespace-pre-line ${step.color}`}>{step.output}</p>
            </div>
          ))}
          <div className="font-semibold text-accent-soft">
            <span className="text-ok">{PROMPT}</span>vi /etc/nginx/conf.d/site.conf && nginx -s reload
            <span className="ml-1 inline-block h-4 w-2 bg-accent align-middle" />
          </div>
        </div>
        <div className="type-label flex justify-between rounded bg-surface px-3 pt-3 pb-1.5 text-ink-muted">
          <span>
            <span className="text-ok">●</span> Active Incident: daily challenge
          </span>
          <span className="flex gap-3">
            <span>Tab: Autocomplete</span>
            <span>⌘+Enter: Run Check</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function TitleBar() {
  return (
    <div className="flex h-9 items-center justify-between bg-surface-raised px-3">
      <span className="flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-[#93000acc]" />
        <span className="size-2.5 rounded-full bg-[#e3aa00cc]" />
        <span className="size-2.5 rounded-full bg-[#43db71cc]" />
        <span className="type-label pl-1 text-ink-muted">greenbuild-sandbox — daily — bash 80x24</span>
      </span>
      <span className="type-label flex items-center gap-1.5 rounded bg-canvas px-2 py-0.5 text-ok">
        <span className="size-1.5 rounded-full bg-ok" />
        CONNECTED
      </span>
    </div>
  );
}
