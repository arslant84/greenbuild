import type { MeResponse } from "@greenbuild/shared";
import type { ReactNode } from "react";
import { CodeIcon } from "../../../ui/icons-profile";
import { AccountCircleIcon, LockIcon, LockResetIcon } from "../../../ui/icons-settings";
import { HEADLINE_LG, LABEL_CODE } from "../../../ui/type";

const SESSION_COLUMNS = ["Device / Client", "Origin IP & Location", "Activity"];

// Frame 7:10273 › Account & Authentication. The email is the player's; changing it, linked sign-in providers
// and the session list have no API yet, so they show "—" and disabled buttons. The frame's "cryptographic
// handshake", tenant and API-secret claims are not true for greenbuild.
export function AccountSection({ me }: { me: MeResponse }) {
  return (
    <section id="section-account" className="flex scroll-mt-20 flex-col gap-5 rounded-xl bg-surface-raised p-5 shadow-sm">
      <div>
        <span className="flex items-center gap-1 type-label text-accent-soft uppercase">
          <LockIcon className="text-[14px]" /> Security &amp; Credentials
        </span>
        <h2 className={`mt-1 ${HEADLINE_LG} text-ink`}>Account &amp; Authentication</h2>
        <p className="type-body text-ink-muted">Your sign-in address, linked accounts and sessions.</p>
      </div>
      <div className="flex flex-col gap-1 rounded-lg bg-surface p-3">
        <span className="type-label text-ink-muted uppercase">Primary Email Address</span>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <span className="relative flex-1">
            <LockIcon className="absolute top-2.5 left-3 text-[18px] text-ink-subtle" />
            <input readOnly aria-label="Primary email address" value={me.email ?? "—"} className={`w-full cursor-not-allowed rounded-lg bg-canvas py-2 pr-3 pl-10 ${LABEL_CODE} text-ink-muted`} />
          </span>
          <button type="button" disabled className="shrink-0 rounded-lg bg-control px-3 py-2 type-label text-ink opacity-60">
            Change email
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="type-label tracking-wider text-ink-subtle uppercase">Connected Providers</h3>
        <Provider icon={<CodeIcon className="text-[20px]" />} name="GitHub" action="Disconnect" />
        <Provider icon={<AccountCircleIcon className="text-[20px]" />} name="Google Workspace" action="Connect Google" />
      </div>
      <Sessions />
    </section>
  );
}

function Provider({ icon, name, action }: { icon: ReactNode; name: string; action: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-surface p-2">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded bg-canvas text-ink-muted">{icon}</span>
        <span>
          <span className="block type-body font-medium text-ink-muted">{name}</span>
          <span className="block type-label text-ink-subtle">—</span>
        </span>
      </div>
      <button type="button" disabled className="rounded bg-control px-3 py-1.5 type-label text-ink opacity-60">
        {action}
      </button>
    </div>
  );
}

function Sessions() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="type-label tracking-wider text-ink-subtle uppercase">Active Device &amp; CLI Sessions</h3>
        <span className="type-label text-ink-subtle">— total tokens</span>
      </div>
      <table className="w-full overflow-hidden rounded-lg bg-surface text-left type-label">
        <thead className="hidden bg-control text-[10px] text-ink-subtle uppercase lg:table-header-group">
          <tr>
            {SESSION_COLUMNS.map((column) => (
              <th key={column} className="p-2 font-normal">
                {column}
              </th>
            ))}
            <th className="p-2 text-right font-normal">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={SESSION_COLUMNS.length + 1} className="p-2 text-ink-muted">
              No session list yet.
            </td>
          </tr>
        </tbody>
      </table>
      <button type="button" disabled className="flex w-fit items-center gap-1 pt-1 type-label text-danger opacity-60">
        <LockResetIcon className="text-[16px]" /> Sign out all other sessions
      </button>
    </div>
  );
}
