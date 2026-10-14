import { type MeResponse, meResponseSchema } from "@greenbuild/shared";
import { apiGet } from "../../server/api";
import { ServiceError } from "../play/service-error";
import { AccountSection } from "./_settings/account-section";
import { NotificationsSection } from "./_settings/notifications-section";
import { ProfileSection } from "./_settings/profile-section";
import { SettingsFooter } from "./_settings/settings-footer";
import { SettingsHeader } from "./_settings/settings-header";
import { SettingsNav } from "./_settings/settings-nav";

export const dynamic = "force-dynamic";

// Figma "Player Settings & Privacy Console" (7:10273), laid out from its Stitch copy (owner, 2026-10-14);
// task 47b. The frame's state simulator bar is a design tool and is not built.
export default async function SettingsPage() {
  const me = await apiGet("/v1/me", meResponseSchema);
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SettingsHeader me={me} />
      {/* The content spans the whole window (owner, 2026-10-14). */}
      <div className="frame grid grid-cols-12 items-start gap-8 px-8 py-8">
        <SettingsNav />
        <main className="col-span-9 flex min-w-0 flex-col gap-8">{me ? <Sections me={me} /> : <ServiceError retryHref="/settings" message="Your settings could not be loaded." />}</main>
      </div>
      <SettingsFooter />
    </div>
  );
}

// The frame's sections in its order; the timezone, visibility, discovery and danger-zone sections follow.
function Sections({ me }: { me: MeResponse }) {
  return (
    <>
      <ProfileSection me={me} />
      <AccountSection me={me} />
      <NotificationsSection />
    </>
  );
}
