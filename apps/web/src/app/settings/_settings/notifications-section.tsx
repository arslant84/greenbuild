import type { ReactNode } from "react";
import { TuneIcon } from "../../../ui/icons-settings";
import { HEADLINE_LG } from "../../../ui/type";

const NOTIFICATIONS = [
  { title: "Weekly engineering digest", note: "Your week in review and your rating changes, every Monday at 08:00 UTC." },
  { title: "Product changelog & incident tracks", note: "New challenges and platform releases." },
  { title: "Company contact requests", note: "An email when a verified company asks for your consent to connect.", badge: "Verified" },
  { title: "Browser push notifications (WebPush)", note: "Desktop notifications before your streak's day ends." },
];

// Frame 7:10273 › Notification Preferences. Reminders and notifications do not exist yet (architecture.md:
// reminders off by default), so every switch shows off and disabled. The frame's percentiles, "cryptographic
// consent", Sev-0 and PWA claims are not true for greenbuild.
export function NotificationsSection() {
  return (
    <section id="section-notifications" className="flex scroll-mt-20 flex-col gap-5 rounded-xl bg-surface-raised p-5 shadow-sm">
      <div>
        <span className="flex items-center gap-1 type-label text-accent-soft uppercase">
          <TuneIcon className="text-[14px]" /> Automated Dispatches
        </span>
        <h2 className={`mt-1 ${HEADLINE_LG} text-ink`}>Notification Preferences</h2>
        <p className="type-body text-ink-muted">Notifications are not available yet.</p>
      </div>
      <div className="flex flex-col gap-3">
        <Preference title="Daily streak reminder" note="An email only if you have not solved a challenge today by the hour you pick.">
          <span className="flex items-center gap-2 pt-1 type-label text-ink-muted">
            Remind me at:
            <select disabled aria-label="Reminder time" className="rounded bg-line px-2 py-0.5 text-ink opacity-60">
              <option>—</option>
            </select>
          </span>
        </Preference>
        {NOTIFICATIONS.map((item) => (
          <Preference key={item.title} title={item.title} note={item.note} badge={item.badge} />
        ))}
      </div>
    </section>
  );
}

function Preference({ title, note, badge, children }: { title: string; note: string; badge?: string | undefined; children?: ReactNode }) {
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
      <label className="relative inline-flex shrink-0 cursor-not-allowed items-center opacity-60">
        <input type="checkbox" disabled aria-label={title} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-line after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-ink-subtle after:content-['']" />
      </label>
    </div>
  );
}
