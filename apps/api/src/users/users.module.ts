import { Module } from "@nestjs/common";
import { MeController } from "./me.controller.js";
import { MeService } from "./me.service.js";

// The player's own profile; discovery modes and data rights join it in Stage 2 (tasks 47a, 50a–50c).
@Module({ controllers: [MeController], providers: [MeService] })
export class UsersModule {}
