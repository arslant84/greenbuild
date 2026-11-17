import type { ConsentHistory } from "@greenbuild/shared";
import { ShieldIcon } from "../../../ui/icons-profile";
import { FingerprintIcon } from "../../../ui/icons-settings";
import { HEADLINE_LG } from "../../../ui/type";
import { type ConsentRow, consentRows } from "./consent-history";
import { VisibilityCards } from "./visibility-cards";

// Who viewed the profile comes with company search (Stage 3, GET /v1/me/viewers).
const VIEWERS_SWITCH = { title: 'Show "Who viewed my profile" audit indicator', note: "Companies see that their visit is shown to you." };

// Frame 7:10273 › Visibility & Privacy Controls. The visibility cards set the game profile public or hidden.
// The viewers switch shows disabled until Stage 3; the frame's country flag and attempt history switches are
// not in the plan, so they are hidden (deviation 37). The consent history is not in the frame (owner,
// 2026-10-14) and lists GET /v1/me/consents. The frame's crawler, UID, telemetry and "cryptographic
// signatures" claims are not true for greenbuild.
export function PrivacySection({ consents, isPublic }: { consents: ConsentHistory | null; isPublic: boolean }) {
  return (
    <section id="section-privacy" className="flex scroll-mt-20 flex-col gap-5 rounded-xl bg-surface-raised p-5 shadow-sm">
      <div>
        <span className="flex items-center gap-1 type-label text-accent-soft uppercase">
          <ShieldIcon className="text-[14px]" /> Exposure Radius
        </span>
        <h2 className={`mt-1 ${HEADLINE_LG} text-ink`}>Visibility &amp; Privacy Controls</h2>
        <p className="type-body text-ink-muted">Who can see your profile, and the consents you gave.</p>
      </div>
      <VisibilityCards initialPublic={isPublic} />
      <label className="flex items-center justify-between gap-2 rounded-lg bg-surface p-2">
        <span>
          <span className="block type-body font-medium text-ink">{VIEWERS_SWITCH.title}</span>
          <span className="block type-label text-ink-subtle">{VIEWERS_SWITCH.note}</span>
        </span>
        <input type="checkbox" disabled aria-label={VIEWERS_SWITCH.title} className="size-4 opacity-60" />
      </label>
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
