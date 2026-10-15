"use client";

import { type ReactNode, useState } from "react";
import { ArchiveIcon, SendIcon, WarningIcon } from "../../../ui/icons-settings";
import { LABEL_CODE } from "../../../ui/type";
import { DELETE_WORD, deleteReady, exportNote } from "./danger";
import type { Danger } from "./use-danger";

// The frame's modal: a blurred overlay over the page with a 480 px card.
function Modal({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4 backdrop-blur-md">
      <div className="flex w-full max-w-[480px] flex-col gap-3 rounded-xl bg-control p-5 shadow-xl">{children}</div>
    </div>
  );
}

// Frame › V7 Export Modal, saying what the export job really does.
export function ExportModal({ email, onDismiss }: { email: string | null; onDismiss: () => void }) {
  return (
    <Modal label="Data Export Initiated">
      <span className="flex items-center gap-1 text-lg leading-6 font-semibold text-accent-soft">
        <ArchiveIcon className="text-[24px]" /> Data Export Initiated
      </span>
      <p className="type-label leading-relaxed text-ink-muted">We are collecting your data into a JSON archive and will email you a link to download it.</p>
      <div className="flex flex-col gap-1 rounded bg-canvas p-2 type-label text-ink-subtle">
        <span className="flex items-center gap-1 text-ink">
          <SendIcon className="text-[16px] text-ok" /> Target Address:
        </span>
        <span className={`${LABEL_CODE} text-accent-soft`}>{email ?? "—"}</span>
        <span className="pt-1 text-[10px]">{exportNote()}</span>
      </div>
      <div className="flex justify-end pt-1">
        <button type="button" onClick={onDismiss} className="rounded bg-accent-soft px-4 py-2 type-label font-medium text-[#00363e]">
          Dismiss
        </button>
      </div>
    </Modal>
  );
}

// Frame › V6 Delete Modal: the box and DELETE typed enable "Delete permanently", as in the frame.
export function DeleteModal({ danger, handle }: { danger: Danger; handle: string | null }) {
  const [understood, setUnderstood] = useState(false);
  const [typed, setTyped] = useState("");
  const ready = deleteReady(understood, typed) && !danger.busy;
  return (
    <Modal label="Permanently delete account?">
      <span className="flex items-center gap-1 text-lg leading-6 font-semibold text-danger">
        <WarningIcon className="text-[24px]" /> Permanently delete account?
      </span>
      <p className="type-label leading-relaxed text-ink-subtle">
        This hides <span className="font-bold text-ink">@{handle ?? "—"}</span> at once, revokes every consent you gave, and deletes your personal data 30 days later.
      </p>
      <label className="flex items-start gap-2 rounded bg-canvas p-2 type-label text-ink-subtle">
        <input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} className="mt-0.5 size-4 accent-danger" />I understand
        that my name, handle, email and sign-in accounts will be deleted after 30 days, and that my attempts and ratings stay without them.
      </label>
      <label className="flex flex-col gap-1 type-label text-ink-subtle uppercase">
        <span>
          Type <strong className="text-danger">{DELETE_WORD}</strong> to confirm:
        </span>
        <input value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={DELETE_WORD} className={`rounded bg-canvas px-3 py-2 ${LABEL_CODE} text-ink normal-case`} />
      </label>
      {danger.error && (
        <p role="alert" className="type-label text-danger">
          {danger.error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={() => danger.open("none")} className="rounded px-4 py-2 type-label text-ink-subtle hover:text-ink">
          Cancel
        </button>
        <button type="button" disabled={!ready} onClick={() => void danger.deleteAccount()} className={`rounded bg-danger px-4 py-2 type-label text-[#690005] ${ready ? "" : "opacity-40"}`}>
          Delete permanently
        </button>
      </div>
      <span className="text-center text-[10px] text-ink-subtle">Deletion cannot be cancelled once confirmed.</span>
    </Modal>
  );
}
