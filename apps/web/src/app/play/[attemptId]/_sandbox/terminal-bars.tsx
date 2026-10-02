import { FolderIcon, LatencyIcon, ShieldIcon, TerminalTabIcon, ViewAgendaIcon } from "../../../../ui/icons";
import type { ConnectionStatus, TerminalSize } from "../protocol";

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  connecting: "connecting",
  connected: "connected",
  disconnected: "disconnected",
  exited: "shell exited",
};

// Figma › Top Pane Switcher Bar (920 × 40). The read-only Files view arrives later; its tab is inert.
export function PaneSwitcher({ status }: { status: ConnectionStatus }) {
  const active = status === "connected";
  return (
    <div className="relative z-[1] flex h-10 shrink-0 items-center justify-between bg-surface px-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex h-full items-center gap-2">
        <span className="relative flex h-full items-center gap-1 bg-canvas px-3 text-accent-soft">
          <TerminalTabIcon />
          <span className="font-mono text-[13px] leading-[18px] font-medium">Terminal</span>
          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />
        </span>
        <span className="flex h-full items-center gap-1 px-3 text-ink-muted" aria-disabled="true">
          <FolderIcon />
          <span className="font-mono text-[13px] leading-[18px]">Files</span>
          <span className="type-label rounded bg-control px-1 text-ink-subtle">RO</span>
        </span>
      </div>
      <span className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className={`size-1.5 rounded-full ${active ? "bg-ok" : "bg-line"}`} />
          <span className={`type-label font-semibold tracking-[0.25px] ${active ? "text-ok" : "text-ink-subtle"}`}>
            {active ? "SANDBOX ACTIVE" : "SANDBOX IDLE"}
          </span>
        </span>
        <span className="rounded p-1 text-ink-muted">
          <ViewAgendaIcon />
        </span>
      </span>
    </div>
  );
}

// Figma › Terminal Chrome Status Pill Bar (920 × 32). The seed stays hidden: it would help solve the challenge.
export function TerminalChrome({ status, incident }: { status: ConnectionStatus; incident: string }) {
  const connected = status === "connected";
  return (
    <div className="flex h-8 shrink-0 items-center justify-between bg-surface-raised px-3 shadow-[inset_0_-1px_0_rgba(0,0,0,0.2)]">
      <span className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${connected ? "bg-ok" : "bg-danger"}`} />
          <span className={`type-label font-medium ${connected ? "text-ok" : "text-danger"}`}>{STATUS_TEXT[status]}</span>
        </span>
        <span className="type-label text-[#3c494c]">/</span>
        <span className="type-label tracking-[0.5px] text-ink-muted">tty</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[11px] leading-[14px] font-medium tracking-[0.44px] text-ink-muted">ATTEMPT:</span>
        <span className="type-term rounded bg-control px-1.5 py-0.5 text-[11px] leading-[14px] font-medium tracking-[0.44px] text-ink">#{incident}</span>
      </span>
      <span className="flex items-center gap-3">
        <span className="type-label rounded bg-control px-1.5 py-0.5 text-ink-subtle">seed: hidden</span>
        <span className="flex items-center gap-1 text-accent-soft">
          <LatencyIcon />
          <span className="type-label">—ms</span>
        </span>
      </span>
    </div>
  );
}

interface FooterNotice {
  text: string;
  tone: "accent" | "danger";
}

// Figma › Terminal Bottom Footer Status Bar (920 × 24); V2 and V4 put their status on the left.
export function TerminalFooter({ size, notice }: { size: TerminalSize | null; notice: FooterNotice | null }) {
  return (
    <div className="flex h-6 shrink-0 items-center justify-between bg-surface px-3">
      {notice ? (
        <span className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${notice.tone === "accent" ? "bg-accent" : "bg-danger"}`} />
          <span className={`type-label font-semibold tracking-[0.25px] ${notice.tone === "accent" ? "text-accent-soft" : "text-danger"}`}>{notice.text}</span>
        </span>
      ) : (
      <span className="flex items-center gap-2">
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-ok" />
          <span className="type-label font-medium text-ink-muted">sh</span>
        </span>
        <span className="type-label text-ink-subtle">·</span>
        <span className="type-label text-ink-subtle">UTF-8</span>
        <span className="type-label text-ink-subtle">·</span>
        <span className="type-label text-ink-subtle">{size ? `${size.cols}×${size.rows}` : "—"}</span>
      </span>
      )}
      <span className="flex items-center gap-1 text-accent-soft">
        <ShieldIcon />
        <span className="type-label text-ink-muted">root-isolated container: cgroup-v2</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="type-label text-ink-muted">latency: —</span>
        <span className="type-label text-ink-muted">·</span>
        <span className="type-label text-ink-subtle">— loss</span>
      </span>
    </div>
  );
}
