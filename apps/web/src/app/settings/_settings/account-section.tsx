import type { MeResponse } from "@greenbuild/shared";
import { LockIcon } from "../../../ui/icons-settings";
import { HEADLINE_LG, LABEL_CODE } from "../../../ui/type";

// Frame 7:10273 › Account & Authentication. The email is the player's. Changing it, linked sign-in
// providers and the session list are not in the plan, so they are hidden (deviation 37). The frame's
// "cryptographic handshake", tenant and API-secret claims are not true for greenbuild.
export function AccountSection({ me }: { me: MeResponse }) {
  return (
    <section id="section-account" className="flex scroll-mt-20 flex-col gap-5 rounded-xl bg-surface-raised p-5 shadow-sm">
      <div>
        <span className="flex items-center gap-1 type-label text-accent-soft uppercase">
          <LockIcon className="text-[14px]" /> Security &amp; Credentials
        </span>
        <h2 className={`mt-1 ${HEADLINE_LG} text-ink`}>Account &amp; Authentication</h2>
        <p className="type-body text-ink-muted">The address you sign in with.</p>
      </div>
      <div className="flex flex-col gap-1 rounded-lg bg-surface p-3">
        <span className="type-label text-ink-muted uppercase">Primary Email Address</span>
        <span className="relative">
          <LockIcon className="absolute top-2.5 left-3 text-[18px] text-ink-subtle" />
          <input readOnly aria-label="Primary email address" value={me.email ?? "—"} className={`w-full cursor-not-allowed rounded-lg bg-canvas py-2 pr-3 pl-10 ${LABEL_CODE} text-ink-muted`} />
        </span>
      </div>
    </section>
  );
}
