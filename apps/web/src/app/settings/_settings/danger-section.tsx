"use client";

import type { MeResponse } from "@greenbuild/shared";
import { ErrorIcon } from "../../../ui/icons-settings";
import { HEADLINE_LG } from "../../../ui/type";
import { DeleteModal, ExportModal } from "./danger-modals";
import { type Danger, useDanger } from "./use-danger";

// Frame 7:10273 › Danger Zone (with its V6 delete and V7 export modals). The export goes through
// POST /api/me/export and arrives by email; deletion goes through DELETE /api/me. The frame's ZIP,
// cryptographic archive, replays, certificates and grace-period claims are not true for greenbuild.
export function DangerSection({ me }: { me: MeResponse }) {
  const danger = useDanger();
  return (
    <section id="section-danger" className="flex scroll-mt-20 flex-col gap-5 rounded-xl bg-surface-raised p-5 shadow-sm">
      <div>
        <span className="flex items-center gap-1 type-label font-bold text-danger uppercase">
          <ErrorIcon className="text-[16px]" /> High Impact Operations
        </span>
        <h2 className={`mt-1 ${HEADLINE_LG} text-danger`}>Danger Zone</h2>
        <p className="type-body text-ink-muted">Download a copy of your data, or delete your account.</p>
      </div>
      <DangerActions danger={danger} />
      {danger.modal === "export" && <ExportModal email={me.email} onDismiss={() => danger.open("none")} />}
      {danger.modal === "delete" && <DeleteModal danger={danger} handle={me.handle} />}
    </section>
  );
}

function DangerActions({ danger }: { danger: Danger }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-[#93000a26] p-3">
      <div className="flex flex-col items-start gap-2 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <span className="flex max-w-[500px] flex-col gap-1">
          <span className="type-body font-medium text-ink">Export personal telemetry ledger</span>
          <span className="type-label text-ink-subtle">A JSON archive of everything we keep about you: account, attempts, XP, ratings, streak and consent history.</span>
        </span>
        <button type="button" disabled={danger.busy} onClick={() => void danger.requestExport()} className="shrink-0 rounded-lg bg-control px-3 py-2 type-label text-ink">
          Request export (JSON)
        </button>
      </div>
      <div className="flex flex-col items-start gap-2 pt-3 lg:flex-row lg:items-center lg:justify-between">
        <span className="flex max-w-[500px] flex-col gap-1">
          <span className="type-body font-medium text-danger">Permanently delete account</span>
          <span className="type-label text-ink-subtle">Your account is hidden at once and your personal data deleted 30 days later. This cannot be undone.</span>
        </span>
        <button type="button" onClick={() => danger.open("delete")} className="shrink-0 rounded-lg bg-[#93000a] px-3 py-2 type-label text-[#ffdad6]">
          Delete account...
        </button>
      </div>
      {danger.error && danger.modal === "none" && (
        <p role="alert" className="type-label text-danger">
          {danger.error}
        </p>
      )}
    </div>
  );
}
