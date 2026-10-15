"use client";

import type { MeResponse } from "@greenbuild/shared";
import { useMemo } from "react";
import { ExpandMoreIcon, LocalFireDepartmentIcon } from "../../../ui/icons-profile";
import { LockClockIcon, WarningIcon } from "../../../ui/icons-settings";
import { useHydrated } from "../../../ui/use-hydrated";
import { useNow } from "../../../ui/use-now";
import { HEADLINE_LG, LABEL_CODE } from "../../../ui/type";
import { offsetLabel, type TimezoneLock, timezoneLock, timezoneOptions, untilDayEnds } from "./timezone";
import { type TimezoneSave, useTimezoneSave } from "./use-timezone-save";

// The frame's 30-day density strip has 18 bars.
const DENSITY_BARS = Array.from({ length: 18 }, (_, bar) => `bar-${bar}`);

// Frame 7:10273 › Timezone & Streak Protection. The timezone saves at once through PATCH /api/me and then
// locks for 30 days, as the frame's "TZ Locked" state shows; the streak, record and freezes are the player's.
// Day-by-day completions have no data yet ("—"). The frame's Glicko-2 delta, cron and SLA claims are not true.
export function TimezoneSection({ me }: { me: MeResponse }) {
  const save = useTimezoneSave(me);
  const now = new Date(useNow());
  const lock = timezoneLock(save.lockedUntil, now);
  const hydrated = useHydrated();
  return (
    <section id="section-timezone" className="flex scroll-mt-20 flex-col gap-5 rounded-xl bg-surface-raised p-5 shadow-sm">
      <div>
        <span className="flex items-center gap-1 type-label text-warn uppercase">
          <LocalFireDepartmentIcon className="text-[14px]" /> Cadence Ledger
        </span>
        <h2 className={`mt-1 ${HEADLINE_LG} text-ink`}>Timezone &amp; Streak Protection</h2>
        <p className="type-body text-ink-muted">When your day ends, and how your streak and freezes stand.</p>
      </div>
      <ZonePicker save={save} locked={lock !== null} now={now} hydrated={hydrated} />
      <div className="flex flex-col gap-1 rounded-lg bg-[#e3aa0026] p-3 text-warn">
        <span className="flex items-center gap-1 type-label font-bold">
          <WarningIcon className="text-[18px]" /> ANTI-EXPLOIT POLICY: 30-DAY COOLDOWN
        </span>
        <p className="type-label leading-relaxed">Your timezone decides when your day ends for the streak. To prevent artificial streak extensions, it can change once every 30 days.</p>
      </div>
      <LockBanner lock={lock} />
      {save.failed && (
        <p role="alert" className="type-label text-danger">
          Your timezone was not saved. Try again.
        </p>
      )}
      <StreakPanel me={me} zone={save.zone} now={now} hydrated={hydrated} />
    </section>
  );
}

function ZonePicker({ save, locked, now, hydrated }: { save: TimezoneSave; locked: boolean; now: Date; hydrated: boolean }) {
  const zones = useMemo(() => (hydrated ? timezoneOptions(save.zone) : [save.zone]), [hydrated, save.zone]);
  return (
    <label className="flex flex-col gap-1">
      <span className="type-label text-ink-muted uppercase">Assigned Ledger Timezone</span>
      <span className="relative">
        <select
          value={save.zone}
          disabled={locked || save.saving}
          onChange={(event) => void save.change(event.target.value)}
          className={`w-full appearance-none rounded-lg bg-canvas px-3 py-2 ${LABEL_CODE} text-ink focus:outline-none disabled:opacity-60`}
        >
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {offsetLabel(zone, now)}
            </option>
          ))}
        </select>
        <ExpandMoreIcon className="pointer-events-none absolute top-2.5 right-3 text-[18px] text-ink-subtle" />
      </span>
    </label>
  );
}

function LockBanner({ lock }: { lock: TimezoneLock | null }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface p-2 type-label text-ink-subtle">
      <span className="flex items-center gap-2">
        <LockClockIcon className="text-[16px] text-warn" />
        {lock ? (
          <span>
            Next timezone change opens in <strong className="text-ink">{lock.days === 1 ? "1 day" : `${lock.days} days`}</strong> ({lock.date}).
          </span>
        ) : (
          <span>You can change your timezone now; the next change opens 30 days later.</span>
        )}
      </span>
      <span className="rounded bg-control px-2 py-0.5 text-[10px]">{lock ? "LOCKED" : "OPEN"}</span>
    </div>
  );
}

function StreakPanel({ me, zone, now, hydrated }: { me: MeResponse; zone: string; now: Date; hydrated: boolean }) {
  const metrics = [
    { label: "CURRENT STREAK", value: `🔥 Day ${me.streak.current}`, color: "text-warn" },
    { label: "ALL-TIME RECORD", value: me.streak.longest === 1 ? "1 day" : `${me.streak.longest} days`, color: "text-ink" },
    { label: "STREAK FREEZES", value: `${me.streak.freezes} avail`, color: "text-accent-soft" },
    { label: "DAILY RESET", value: hydrated ? untilDayEnds(zone, now) : "—", color: "text-ok" },
  ];
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-canvas p-3">
      <span className="flex items-center justify-between type-label">
        <span className="tracking-wider text-ink-subtle uppercase">Telemetry Snapshot</span>
        <span className="flex items-center gap-1 text-ok">
          <span className="size-1.5 rounded-full bg-ok" /> SYNCED
        </span>
      </span>
      <div className="grid grid-cols-4 gap-2">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded bg-surface p-2">
            <span className="block type-label text-ink-subtle">{metric.label}</span>
            <span className={`mt-1 block text-lg leading-6 font-bold ${metric.color}`}>{metric.value}</span>
          </div>
        ))}
      </div>
      <span className="flex items-center justify-between type-label text-ink-subtle">
        <span>30-Day Completion Density</span>
        <span>—</span>
      </span>
      <div className="flex h-6 items-center gap-1">
        {DENSITY_BARS.map((bar) => (
          <span key={bar} className="h-full flex-1 rounded-sm bg-control" />
        ))}
      </div>
      <span className="type-label text-accent-soft opacity-60">View historical streak ledger &amp; incident log →</span>
    </div>
  );
}
