"use client";

import type { MeResponse } from "@greenbuild/shared";
import { PersonIcon, TerminalIcon } from "../../../ui/icons-profile";
import { CheckCircleIcon, InfoIcon } from "../../../ui/icons-settings";
import { HEADLINE_LG, LABEL_CODE } from "../../../ui/type";
import { DISPLAY_NAME_HINT, HANDLE_HINT, profileFields } from "./profile-form";
import { type ProfileSave, useProfileSave } from "./use-profile-save";

const LABEL = "mb-1 block type-label text-ink-muted uppercase";
const INPUT = "w-full rounded-lg bg-canvas px-3 py-2 text-ink focus:bg-control focus:outline-none";

// Frame 7:10273 › Profile Settings. Name and handle save through PATCH /api/me (Save is enabled once
// something changed, as in the frame's "Dirty State"); avatar, country and bio have no API yet and show
// disabled. The frame's identicon, credential ledger and terminal-token claims are not true for greenbuild.
export function ProfileSection({ me }: { me: MeResponse }) {
  const form = useProfileSave(profileFields(me));
  return (
    <section id="section-profile" className="flex scroll-mt-20 flex-col gap-5 rounded-xl bg-surface-raised p-5 shadow-sm">
      <div>
        <span className="flex items-center gap-1 type-label text-accent-soft uppercase">
          <TerminalIcon className="text-[14px]" /> Identity Configuration
        </span>
        <h2 className={`mt-1 ${HEADLINE_LG} text-ink`}>Profile Settings</h2>
        <p className="type-body text-ink-muted">Manage your public name and handle.</p>
      </div>
      <AvatarBlock />
      <IdentityFields form={form} />
      <div className="flex items-start gap-2 rounded-lg bg-[#e3aa0026] p-2 text-warn">
        <InfoIcon className="mt-0.5 text-[18px]" />
        <span className="type-label leading-relaxed">
          Changing your handle changes your public profile link (<span className="font-bold text-ink underline">/u/{form.edited.handle || "handle"}</span>); links to the old
          handle stop working.
        </span>
      </div>
      <UnavailableFields country={me.country} />
      <ActionBar form={form} />
    </section>
  );
}

function AvatarBlock() {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface p-3">
      <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-line text-ink-subtle">
        <PersonIcon className="text-[40px]" />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled className="rounded-lg bg-control px-3 py-1.5 type-label text-ink opacity-60">
            Change avatar
          </button>
          <button type="button" disabled className="rounded-lg px-3 py-1.5 type-label text-ink-subtle opacity-60">
            Remove
          </button>
        </div>
        <p className="type-label text-ink-subtle">Avatar uploads are not available yet.</p>
      </div>
    </div>
  );
}

function IdentityFields({ form }: { form: ProfileSave }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <label>
        <span className={LABEL}>Display Name</span>
        <input className={`${INPUT} type-body`} value={form.edited.display_name} onChange={(event) => form.edit({ display_name: event.target.value })} />
        <span className="mt-1 block type-label text-ink-subtle">{DISPLAY_NAME_HINT}</span>
      </label>
      <label>
        <span className={LABEL}>Handle</span>
        <span className="relative flex items-center">
          <span className={`absolute left-3 ${LABEL_CODE} text-ink-subtle`}>@</span>
          <input className={`${INPUT} pl-8 ${LABEL_CODE}`} value={form.edited.handle} onChange={(event) => form.edit({ handle: event.target.value })} />
        </span>
        <span className="mt-1 block type-label text-ink-subtle">{HANDLE_HINT}</span>
      </label>
    </div>
  );
}

function UnavailableFields({ country }: { country: string | null }) {
  return (
    <>
      <label>
        <span className={LABEL}>Location / Jurisdiction</span>
        <select disabled className={`${INPUT} type-body opacity-60`} value={country ?? ""}>
          <option value={country ?? ""}>{country ?? "—"}</option>
        </select>
      </label>
      <label>
        <span className="mb-1 flex items-center justify-between">
          <span className="type-label text-ink-muted uppercase">Engineering Bio</span>
          <span className="type-label text-ink-subtle">0 / 160</span>
        </span>
        <textarea disabled rows={3} className={`${INPUT} type-body resize-none opacity-60`} placeholder="Bios are not available yet." />
      </label>
    </>
  );
}

function ActionBar({ form }: { form: ProfileSave }) {
  const ready = form.dirty && form.status.kind !== "saving";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!ready}
          onClick={() => void form.save()}
          className={`rounded-lg px-4 py-2 type-label font-medium ${ready ? "bg-accent-soft text-[#00363e] shadow-md" : "bg-accent text-[#005763] opacity-40"}`}
        >
          {form.status.kind === "saving" ? "Saving..." : "Save changes"}
        </button>
        <button type="button" onClick={form.reset} className="type-label text-ink-subtle hover:text-ink">
          Reset
        </button>
      </div>
      {form.status.kind === "saved" && (
        <span role="status" className="flex items-center gap-1 type-label text-ok">
          <CheckCircleIcon className="text-[16px]" /> Changes saved
        </span>
      )}
      {form.status.kind === "failed" && (
        <span role="alert" className="type-label text-danger">
          {form.status.message}
        </span>
      )}
    </div>
  );
}
