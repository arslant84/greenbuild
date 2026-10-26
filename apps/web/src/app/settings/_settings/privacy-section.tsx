import type { ConsentHistory } from "@greenbuild/shared";
import { ShieldIcon } from "../../../ui/icons-profile";
import { FingerprintIcon, RadioButtonUncheckedIcon } from "../../../ui/icons-settings";
import { HEADLINE_LG } from "../../../ui/type";
import { type ConsentRow, consentRows } from "./consent-history";

const VISIBILITY = [
  { title: "Public", note: "Anyone can view your game profile at /u/your-handle." },
  { title: "Companies only", note: "Hidden from visitors; only verified companies can find you, without your name." },
  { title: "Hidden", note: "Only you can view your profile, and the leaderboards list you without a name." },
];
const SWITCHES = [
  { title: "Show country flag & ISO code on profile", note: "Shows your country next to your handle." },
  { title: "Show recent incident attempt history", note: "Visitors can see which challenges you solved and when." },
  { title: 'Show "Who viewed my profile" audit indicator', note: "Companies see that their visit is shown to you." },
];

// Frame 7:10273 › Visibility & Privacy Controls. Choosing the game profile's visibility and the three switches
// have no API yet, so nothing is selected and they show disabled. The consent history is not in the frame
// (owner, 2026-10-14) and lists GET /v1/me/consents. The frame's crawler, UID, telemetry and "cryptographic
// signatures" claims are not true for greenbuild.
export function PrivacySection({ consents }: { consents: ConsentHistory | null }) {
  return (
    <section id="section-privacy" className="flex scroll-mt-20 flex-col gap-5 rounded-xl bg-surface-raised p-5 shadow-sm">
      <div>
        <span className="flex items-center gap-1 type-label text-accent-soft uppercase">
          <ShieldIcon className="text-[14px]" /> Exposure Radius
        </span>
        <h2 className={`mt-1 ${HEADLINE_LG} text-ink`}>Visibility &amp; Privacy Controls</h2>
        <p className="type-body text-ink-muted">Who can see your profile, and the consents you gave.</p>
      </div>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        {VISIBILITY.map((card) => (
          <div key={card.title} aria-disabled="true" className="rounded-lg bg-surface p-3 opacity-60">
            <span className="flex items-center justify-between type-body font-semibold text-ink">
              {card.title}
              <RadioButtonUncheckedIcon className="text-[18px] text-ink-subtle" />
            </span>
            <p className="mt-2 type-label text-ink-subtle">{card.note}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {SWITCHES.map((item) => (
          <label key={item.title} className="flex items-center justify-between gap-2 rounded-lg bg-surface p-2">
            <span>
              <span className="block type-body font-medium text-ink">{item.title}</span>
              <span className="block type-label text-ink-subtle">{item.note}</span>
            </span>
            <input type="checkbox" disabled aria-label={item.title} className="size-4 opacity-60" />
          </label>
        ))}
      </div>
      <ConsentList rows={consents ? consentRows(consents) : null} />
      <p className="flex items-center gap-2 rounded-lg bg-canvas p-2 type-label text-ink-subtle">
        <FingerprintIcon className="text-[16px]" />
        We keep your attempts and ratings while your account is active. You can request an export or delete your account below at any point.
      </p>
    </section>
  );
}

function ConsentList({ rows }: { rows: ConsentRow[] | null }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="type-label tracking-wider text-ink-subtle uppercase">Consent History</h3>
      {rows === null && <p className="type-label text-ink-muted">Your consent history could not be loaded.</p>}
      {rows?.length === 0 && <p className="type-label text-ink-muted">No consents yet.</p>}
      {rows && rows.length > 0 && (
        <ul aria-label="Consent history" className="flex flex-col gap-1">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center justify-between rounded bg-surface px-2 py-1.5 type-label">
              <span className="text-ink">
                {row.label} <span className="text-ink-subtle">v{row.version} · given {row.granted}</span>
              </span>
              <span className={row.active ? "text-ok" : "text-ink-subtle"}>{row.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
