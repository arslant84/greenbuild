import { Module } from "@nestjs/common";
import { ConsentsController } from "./consents.controller.js";
import { Consents } from "./consents.js";
import { DiscoveryController } from "./discovery.controller.js";
import { Discovery } from "./discovery.js";
import { MeController } from "./me.controller.js";
import { MeService } from "./me.service.js";
import { PublicProfileController } from "./public-profile.controller.js";
import { PublicProfiles } from "./public-profile.js";

// The player's own profile, their public game profile, discovery mode and consent history; export and
// deletion join them (tasks 50a–50b).
@Module({
  controllers: [MeController, PublicProfileController, DiscoveryController, ConsentsController],
  providers: [MeService, PublicProfiles, Discovery, Consents],
})
export class UsersModule {}
