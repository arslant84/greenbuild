"use client";

import type { Notifications } from "@greenbuild/shared";
import type { ReactNode } from "react";
import { TuneIcon } from "../../../ui/icons-settings";
import { HEADLINE_LG } from "../../../ui/type";
import { hourLabel, REMINDER_HOURS } from "./notifications";
import { type NotificationsSave, useNotifications } from "./use-notifications";

const NOTIFICATIONS = [
  { title: "Weekly engineering digest", note: "Your week in review and your rating changes, every Monday at 08:00 UTC." },
  { title: "Product changelog & incident tracks", note: "New challenges and platform releases." },
  { title: "Company contact requests", note: "An email when a verified company asks for your consent to connect.", badge: "Verified" },
  { title: "Browser push notifications (WebPush)", note: "Desktop notifications before your streak's day ends." },
];

const REMINDER_TITLE = "Daily streak reminder";

// Frame 7:10273 › Notification Preferences. The daily streak reminder works (task 52); the other
// notifications do not exist yet, so their switches show off and disabled. The frame's percentiles,
// "cryptographic consent", Sev-0 and PWA claims are not true for greenbuild.
export function NotificationsSection({ initial }: { initial: Notifications }) {
  const save = useNotifications(initial);
  return (
    <section id="section-notifications" className="flex scroll-mt-20 flex-col gap-5 rounded-xl bg-surface-raised p-5 shadow-sm">
      <div>
        <span className="flex items-center gap-1 type-label text-accent-soft uppercase">
          <TuneIcon className="text-[14px]" /> Automated Dispatches
        </span>
        <h2 className={`mt-1 ${HEADLINE_LG} text-ink`}>Notification Preferences</h2>
        <p className="type-body text-ink-muted">Only the daily streak reminder is available yet.</p>
      </div>
      <div className="flex flex-col gap-3">
        <StreakReminder save={save} />
        {NOTIFICATIONS.map((item) => (
          <Preference key={item.title} title={item.title} note={item.note} badge={item.badge} switchControl={<Switch title={item.title} checked={false} />} />
        ))}
      </div>
    </section>
  );
}

function StreakReminder({ save }: { save: NotificationsSave }) {
  const { notifications } = save;
  return (
    <Preference
      title={REMINDER_TITLE}
      note="An email only if you have not solved a challenge today by the hour you pick."
      switchControl={<Switch title={REMINDER_TITLE} checked={notifications.streak_reminder_email} disabled={save.saving} onChange={(on) => void save.save({ ...notifications, streak_reminder_email: on })} />}
    >
      <span className="flex items-center gap-2 pt-1 type-label text-ink-muted">
        Remind me at:
        <select
          aria-label="Reminder time"
          value={notifications.reminder_hour}
          disabled={save.saving}
          onChange={(event) => void save.save({ ...notifications, reminder_hour: Number(event.target.value) })}
          className="rounded bg-line px-2 py-0.5 text-ink"
        >
          {REMINDER_HOURS.map((hour) => (
            <option key={hour} value={hour}>
              {hourLabel(hour)}
            </option>
          ))}
        </select>
        <span>your time</span>
      </span>
      {save.error && (
        <span role="alert" className="type-label text-danger">
          {save.error}
        </span>
      )}
    </Preference>
  );
}

interface PreferenceProps {
  title: string;
  note: string;
  badge?: string | undefined;
  switchControl: ReactNode;
  children?: ReactNode;
}

function Preference({ title, note, badge, switchControl, children }: PreferenceProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-surface p-3">
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1 type-body font-medium text-ink">
          {title}
          {badge && <span className="rounded bg-[#e3aa0033] px-1.5 py-0.5 type-label text-warn">{badge}</span>}
        </span>
        <span className="type-label text-ink-subtle">{note}</span>
        {children}
      </div>
      {switchControl}
    </div>
  );
}

// The frame's switch; without onChange it stays off and disabled.
function Switch({ title, checked, disabled, onChange }: { title: string; checked: boolean; disabled?: boolean; onChange?: (on: boolean) => void }) {
  const off = !onChange;
  return (
    <label className={`relative inline-flex shrink-0 items-center ${off ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
      <input type="checkbox" aria-label={title} checked={checked} disabled={off || disabled} onChange={(event) => onChange?.(event.target.checked)} className="peer sr-only" />
      <span className="h-6 w-11 rounded-full bg-line peer-checked:bg-accent after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-ink-subtle after:transition-all after:content-[''] peer-checked:after:translate-x-5 peer-checked:after:bg-[#00363e]" />
    </label>
  );
}
