import { Module } from "@nestjs/common";
import { MeController } from "./me.controller.js";
import { MeService } from "./me.service.js";
import { PublicProfileController } from "./public-profile.controller.js";
import { PublicProfiles } from "./public-profile.js";

// The player's own profile and their public game profile; discovery modes and data rights join them in
// Stage 2 (tasks 47a, 50a–50c).
@Module({ controllers: [MeController, PublicProfileController], providers: [MeService, PublicProfiles] })
export class UsersModule {}
