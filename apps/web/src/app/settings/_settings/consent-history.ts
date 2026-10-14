import type { ConsentHistory } from "@greenbuild/shared";

// The consent history list in the settings' Visibility & Privacy section (task 47b; not in the frame, owner
// 2026-10-14), from GET /v1/me/consents.

type Consent = ConsentHistory["consents"][number];

const KIND_LABELS: Record<Consent["kind"], string> = {
  terms: "Terms of service",
  privacy: "Privacy policy",
  discovery: "Company discovery",
  verified_recording: "Verified session recording",
};

export interface ConsentRow {
  key: string;
  label: string;
  version: string;
  granted: string;
  status: string;
  active: boolean;
}

function day(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
}

// consentRows keeps the API's order (newest first) and says whether each consent still holds.
export function consentRows(history: ConsentHistory): ConsentRow[] {
  return history.consents.map((consent) => ({
    key: `${consent.kind}-${consent.granted_at}`,
    label: KIND_LABELS[consent.kind],
    version: consent.version,
    granted: day(consent.granted_at),
    status: consent.revoked_at ? `Revoked ${day(consent.revoked_at)}` : "Active",
    active: consent.revoked_at === null,
  }));
}
