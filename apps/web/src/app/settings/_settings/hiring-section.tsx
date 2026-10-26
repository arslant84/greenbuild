"use client";

import type { DiscoveryResponse } from "@greenbuild/shared";
import type { ReactNode } from "react";
import { ShieldIcon } from "../../../ui/icons-profile";
import { CasesIcon, VisibilityIcon } from "../../../ui/icons-settings";
import { HEADLINE_LG, LABEL_CODE } from "../../../ui/type";
import { isFindable, statusLabel } from "./discovery";
import { type DiscoverySave, useDiscovery } from "./use-discovery";

// What a company sees of a findable player, and what stays hidden until the player accepts its request
// (architecture.md, «Жизненный цикл согласия»: the anonymous card).
const VISIBLE = ["Skill ratings with their 95% intervals", "Region (country or timezone)", "Level and last activity"];
const SHIELDED = ["Your name, handle and avatar", "Your email address", "GitHub, LinkedIn and website links you choose to share"];

// Frame 7:10273 › Open to Offers (states V4 off, V5 on). The switch saves through PUT /api/me/discovery; the
// 18+ checkbox is not in the frame (owner, 2026-10-14) and shows until the player confirms. The note, salary
// floor and role level have no API yet (disabled). The frame's handle-and-streak visibility, cryptographic
// outreach and DPA claims are not true for greenbuild.
export function HiringSection({ initial }: { initial: DiscoveryResponse }) {
  const save = useDiscovery(initial);
  const findable = isFindable(save.discovery);
  return (
    <section id="section-hiring" className="flex scroll-mt-20 flex-col gap-5 rounded-xl bg-surface-raised p-5 shadow-sm">
      <div>
        <span className="flex items-center gap-1 type-label text-warn uppercase">
          <CasesIcon className="text-[14px]" /> Talent Protocol
        </span>
        <h2 className={`mt-1 ${HEADLINE_LG} text-ink`}>Open to Offers</h2>
        <p className="type-body text-ink-muted">Choose whether companies may find you, and what they see before you agree.</p>
      </div>
      <div className="flex flex-col gap-3 rounded-xl bg-surface p-3">
        <MasterSwitch save={save} findable={findable} />
        {findable ? <OnView /> : <OffView />}
      </div>
    </section>
  );
}

function MasterSwitch({ save, findable }: { save: DiscoverySave; findable: boolean }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-lg leading-6 font-medium text-ink">Candidate Discovery Protocol</span>
          <span className={`inline-flex w-fit items-center gap-1.5 rounded px-2 py-0.5 type-label ${findable ? "bg-[#e3aa0033] text-warn" : "bg-line text-ink-subtle"}`}>
            <span className={`size-1.5 rounded-full ${findable ? "bg-warn" : "bg-ink-subtle"}`} /> {statusLabel(findable)}
          </span>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            aria-label="Open to offers"
            checked={findable}
            disabled={save.saving}
            onChange={(event) => void save.toggle(event.target.checked)}
            className="peer sr-only"
          />
          <span className="h-7 w-14 rounded-full bg-line peer-checked:bg-warn after:absolute after:top-[3px] after:left-[3px] after:h-5 after:w-6 after:rounded-full after:bg-[#5a4100] after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
        </label>
      </div>
      {!save.discovery.age_confirmed_18 && (
        <label className="flex items-center gap-2 type-label text-ink-muted">
          <input type="checkbox" checked={save.confirmed18} onChange={(event) => save.setConfirmed18(event.target.checked)} className="size-4 accent-warn" />I am 18 or
          older (companies may only find adults)
        </label>
      )}
      {save.error && (
        <p role="alert" className="type-label text-danger">
          {save.error}
        </p>
      )}
    </>
  );
}

function OffView() {
  return (
    <div className="flex flex-col gap-3">
      <p className="rounded bg-canvas p-2 type-label text-ink-muted">
        You are hidden from companies. Turn this on to appear in their searches without your name; a company learns who you are only after you accept its
        request. Company accounts are not open yet.
      </p>
      <span className="type-label text-ink-subtle uppercase">Trust &amp; Privacy Matrix:</span>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <Matrix tone="text-ok" background="bg-ok/10" title="WHAT COMPANIES CAN SEE" icon={<VisibilityIcon className="text-[16px]" />} items={VISIBLE} />
        <Matrix tone="text-danger" background="bg-[#93000a1a]" title="SHIELDED UNTIL YOU CONSENT" icon={<ShieldIcon className="text-[16px]" />} items={SHIELDED} />
      </div>
    </div>
  );
}

function Matrix({ tone, background, title, icon, items }: { tone: string; background: string; title: string; icon: ReactNode; items: string[] }) {
  return (
    <div className={`flex flex-col gap-1 rounded p-2 ${background}`}>
      <span className={`flex items-center gap-1 type-label font-bold ${tone}`}>
        {icon} {title}
      </span>
      <ul className="list-inside list-disc type-label text-ink">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function OnView() {
  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex items-center justify-between rounded bg-[#e3aa001a] p-2">
        <span>
          <span className="block type-body font-medium text-warn">Verified companies only</span>
          <span className="block type-label text-ink-subtle">A company must verify its domain before it can search.</span>
        </span>
        <input type="checkbox" checked disabled aria-label="Verified companies only" className="size-4 accent-warn" />
      </div>
      <label>
        <span className="mb-1 flex items-center justify-between type-label text-ink-muted uppercase">
          Candidate Broadcast Note <span className="text-ink-subtle normal-case">0 / 200</span>
        </span>
        <textarea disabled rows={3} placeholder="Notes for companies are not available yet." className="w-full resize-none rounded-lg bg-canvas px-3 py-2 type-body text-ink opacity-60" />
      </label>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <DisabledSelect label="Salary Floor (Base USD)" />
        <DisabledSelect label="Target Role Level" />
      </div>
      <span className="type-label text-warn opacity-60">Learn how consent works →</span>
    </div>
  );
}

function DisabledSelect({ label }: { label: string }) {
  return (
    <label>
      <span className="mb-1 block type-label text-ink-muted uppercase">{label}</span>
      <select disabled className={`w-full rounded-lg bg-canvas px-3 py-2 ${LABEL_CODE} text-ink opacity-60`}>
        <option>—</option>
      </select>
    </label>
  );
}
