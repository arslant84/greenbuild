import {
  type ConsentHistory,
  consentHistorySchema,
  type DiscoveryResponse,
  discoveryResponseSchema,
  type MeResponse,
  meResponseSchema,
  type Notifications,
  notificationsSchema,
} from "@greenbuild/shared";
import { apiGet } from "../../server/api";
import { ServiceError } from "../play/service-error";
import { AccountSection } from "./_settings/account-section";
import { DangerSection } from "./_settings/danger-section";
import { HiringSection } from "./_settings/hiring-section";
import { NotificationsSection } from "./_settings/notifications-section";
import { PrivacySection } from "./_settings/privacy-section";
import { ProfileSection } from "./_settings/profile-section";
import { SettingsFooter } from "./_settings/settings-footer";
import { SettingsHeader } from "./_settings/settings-header";
import { SettingsNav } from "./_settings/settings-nav";
import { TimezoneSection } from "./_settings/timezone-section";

export const dynamic = "force-dynamic";

// Figma "Player Settings & Privacy Console" (7:10273), laid out from its Stitch copy (owner, 2026-10-14);
// task 47b. The frame's state simulator bar is a design tool and is not built.
export default async function SettingsPage() {
  const [me, discovery, consents, notifications] = await Promise.all([
    apiGet("/v1/me", meResponseSchema),
    apiGet("/v1/me/discovery", discoveryResponseSchema),
    apiGet("/v1/me/consents", consentHistorySchema),
    apiGet("/v1/me/notifications", notificationsSchema),
  ]);
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SettingsHeader me={me} />
      {/* The content spans the whole window (owner, 2026-10-14). */}
      <div className="frame grid grid-cols-12 items-start gap-8 px-8 py-8">
        <SettingsNav />
        <main className="col-span-9 flex min-w-0 flex-col gap-8">{me && discovery && notifications ? <Sections me={me} discovery={discovery} consents={consents} notifications={notifications} /> : <ServiceError retryHref="/settings" message="Your settings could not be loaded." />}</main>
      </div>
      <SettingsFooter />
    </div>
  );
}

// The frame's sections in its order.
interface SectionsProps {
  me: MeResponse;
  discovery: DiscoveryResponse;
  consents: ConsentHistory | null;
  notifications: Notifications;
}

function Sections({ me, discovery, consents, notifications }: SectionsProps) {
  return (
    <>
      <ProfileSection me={me} />
      <AccountSection me={me} />
      <TimezoneSection me={me} />
      <NotificationsSection initial={notifications} />
      <PrivacySection consents={consents} />
      <HiringSection initial={discovery} />
      <DangerSection me={me} />
    </>
  );
}
