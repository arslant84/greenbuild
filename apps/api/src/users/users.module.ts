import { Module } from "@nestjs/common";
import { DiscoveryController } from "./discovery.controller.js";
import { Discovery } from "./discovery.js";
import { MeController } from "./me.controller.js";
import { MeService } from "./me.service.js";
import { PublicProfileController } from "./public-profile.controller.js";
import { PublicProfiles } from "./public-profile.js";

// The player's own profile, their public game profile and discovery mode; data rights join them in
// Stage 2 (tasks 50a–50c).
@Module({ controllers: [MeController, PublicProfileController, DiscoveryController], providers: [MeService, PublicProfiles, Discovery] })
export class UsersModule {}
