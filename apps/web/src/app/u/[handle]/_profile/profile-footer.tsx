import { LABEL_BADGE, LABEL_CODE } from "./type";

// Frame 3:4532 › profile footnote and page footer. The evaluation time, build and system status have no
// data yet ("—"); reporting a profile has no feature yet (text). The frame's SOC2 audit, protocol RFC and
// proof engine are not true for greenbuild and are left out of the labels.
export function ProfileFooter() {
  return (
    <>
      <footer className="flex items-center justify-between gap-2 border-t border-control bg-canvas/50 px-6 py-3 type-label text-ink-subtle">
        <span className="flex items-center gap-3">
          <span>Profile last evaluated —</span>
          <span>·</span>
          <span>Report profile inconsistency</span>
          <span>·</span>
          <span>Audit trail —</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-ok" />
          <span className="text-ink-muted">greenbuild beta</span>
        </span>
      </footer>
      <footer className="mt-8 flex items-center justify-between gap-3 bg-canvas px-6 py-8">
        <span className="flex items-center gap-3">
          <span className={`${LABEL_CODE} text-ink-muted`}>&gt;_ GREENBUILD</span>
          <span className="type-label text-ink-subtle">SHA: —</span>
        </span>
        <span className="flex items-center gap-5">
          <span className="type-label text-ink-muted">© 2026 GREENBUILD</span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-ink-subtle" />
            <span className={`${LABEL_BADGE} text-ink-subtle`}>STATUS —</span>
          </span>
        </span>
      </footer>
    </>
  );
}
