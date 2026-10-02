// Figma › Footer (1280 × 32): keyboard shortcuts and sandbox state.
const KEY = "rounded border border-[#3c494c] bg-control px-1.5 py-0.5 font-mono text-[10px] leading-3 tracking-[0.2px] text-ink";

export function ShortcutBar({ running }: { running: boolean }) {
  return (
    <footer className="relative z-10 flex h-8 shrink-0 items-center justify-between bg-surface px-4 shadow-[0_-1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-5">
        <Shortcut keys="⌘/Ctrl + Enter" label="Check Solution" />
        <Shortcut keys="⌘/Ctrl + H" label="Hint" />
        <Shortcut keys="⌘/Ctrl + Shift + Q" label="Give Up" danger />
      </div>
      <span className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className={`size-1.5 rounded-full ${running ? "bg-ok" : "bg-line"}`} />
          <span className={`type-label ${running ? "text-ok" : "text-ink-subtle"}`}>{running ? "KERNEL RUNNING" : "KERNEL STOPPED"}</span>
        </span>
        <span className="type-label text-ink-subtle">|</span>
        <span className="type-label text-ink-muted">NODE —</span>
      </span>
    </footer>
  );
}

function Shortcut({ keys, label, danger = false }: { keys: string; label: string; danger?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className={KEY}>{keys}</kbd>
      <span className={`type-label ${danger ? "text-danger" : "text-ink"}`}>{label}</span>
    </span>
  );
}
