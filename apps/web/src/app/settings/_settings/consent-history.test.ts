import { describe, expect, it } from "vitest";
import { consentRows } from "./consent-history";

describe("consentRows", () => {
  it("names each consent, keeps the API's order, and says whether it still holds", () => {
    const rows = consentRows({
      consents: [
        { kind: "discovery", version: "2026-10-11", granted_at: "2026-10-15T09:00:00.000Z", revoked_at: null },
        { kind: "discovery", version: "2026-10-11", granted_at: "2026-10-14T09:00:00.000Z", revoked_at: "2026-10-14T18:00:00.000Z" },
      ],
    });

    expect(rows.map(({ label, version, granted, status, active }) => ({ label, version, granted, status, active }))).toEqual([
      { label: "Company discovery", version: "2026-10-11", granted: "Oct 15, 2026", status: "Active", active: true },
      { label: "Company discovery", version: "2026-10-11", granted: "Oct 14, 2026", status: "Revoked Oct 14, 2026", active: false },
    ]);
  });

  it("is empty for a player who gave no consent", () => {
    expect(consentRows({ consents: [] })).toEqual([]);
  });
});
