// Figma (Global Standings) › Telemetry Diagnostic Context Bento Footer and Footer. The frame's cards
// claim things greenbuild does not do (Firecracker microVMs, eBPF traces, a recruitment feed, cluster
// status); as on the landing (owner, 2026-10-08) they keep their layout and say what is true.
const CARDS = [
  {
    label: "RATING ENGINE",
    status: "GLICKO-2",
    statusColor: "text-ok",
    title: "Skill ratings, game by game",
    body: "Each finished attempt is a game between you and the challenge; τ = 0.5. Weekly boards count XP and reset Monday 00:00 UTC.",
  },
  {
    label: "VERIFICATION",
    status: "SANDBOXED",
    statusColor: "text-accent",
    title: "gVisor sandbox per attempt",
    body: "Every attempt runs in its own sandbox with no network; the challenge's check script decides whether the fix holds.",
  },
  {
    label: "DISCOVERY",
    status: "OPT-IN",
    statusColor: "text-warn",
    title: "Companies find you only if you allow it",
    body: "Your profile stays hidden from companies until you turn on discovery in your settings.",
  },
];

export function ContextCards() {
  return (
    <div className="flex gap-3 pt-1">
      {CARDS.map((card) => (
        <div key={card.label} className="flex flex-1 flex-col gap-1 rounded-lg bg-surface p-3">
          <span className="flex items-center justify-between type-label">
            <span className="text-ink-subtle">{card.label}</span>
            <span className={card.statusColor}>{card.status}</span>
          </span>
          <span className="type-body font-medium text-ink">{card.title}</span>
          <span className="type-body text-ink-muted">{card.body}</span>
        </div>
      ))}
    </div>
  );
}

export function StandingsFooter() {
  return (
    <footer className="flex h-7 items-center justify-between bg-canvas px-6">
      <span className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-ok" />
        <span className="type-label tracking-[0.5px] text-ok">ALL BOARDS IN UTC</span>
      </span>
      <span className="type-label text-ink-subtle">© 2026 GREENBUILD</span>
    </footer>
  );
}
