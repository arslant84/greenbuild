import { Module } from "@nestjs/common";
import { ConsentsController } from "./consents.controller.js";
import { Consents } from "./consents.js";
import { DataExport } from "./data-export.js";
import { ExportArchives } from "./export-archives.js";
import { AccountDeletion } from "./deletion.js";
import { DiscoveryController } from "./discovery.controller.js";
import { Discovery } from "./discovery.js";
import { MeController } from "./me.controller.js";
import { MeService } from "./me.service.js";
import { NotificationsController } from "./notifications.controller.js";
import { NotificationSettings } from "./notifications.js";
import { PublicProfileController } from "./public-profile.controller.js";
import { PublicProfiles } from "./public-profile.js";
import { UnsubscribeController } from "./unsubscribe.controller.js";

// The player's own profile, their public game profile, discovery mode, consent history and reminder
// settings (task 52); export and deletion join them (tasks 50a–50b).
@Module({
  controllers: [MeController, PublicProfileController, DiscoveryController, ConsentsController, NotificationsController, UnsubscribeController],
  providers: [MeService, PublicProfiles, Discovery, Consents, AccountDeletion, DataExport, ExportArchives, NotificationSettings],
})
export class UsersModule {}
