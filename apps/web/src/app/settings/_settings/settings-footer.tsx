import { LockIcon, SpeedIcon } from "../../../ui/icons-settings";

// Frame 7:10273 › footer. System status, latency and compliance have no data or audit behind them ("—"); the
// docs, status and security pages do not exist (text). It stays at the window's bottom (owner, 2026-10-14).
export function SettingsFooter() {
  return (
    <footer className="sticky bottom-0 z-10 mt-auto bg-canvas shadow-[0_-1px_8px_rgba(0,0,0,0.3)]">
      <div className="frame flex items-center justify-between gap-3 px-6 py-5 type-label text-ink-muted">
        <span className="flex items-center gap-5">
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-ink-subtle" />
            <span className="text-ink">STATUS —</span>
          </span>
          <span className="flex items-center gap-1 text-ink-subtle">
            <SpeedIcon className="text-[14px]" /> LATENCY: —
          </span>
          <span className="flex items-center gap-1 text-ink-subtle">
            <LockIcon className="text-[14px]" /> SECOPS —
          </span>
        </span>
        <span className="flex items-center gap-5">
          <span>DOCS</span>
          <span>STATUS</span>
          <span>SECURITY</span>
          <span className="text-[#3c494c]">© 2026 GREENBUILD</span>
        </span>
      </div>
    </footer>
  );
}
