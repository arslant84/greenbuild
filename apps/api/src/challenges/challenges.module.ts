import { Module } from "@nestjs/common";
import { DevUserGuard } from "../auth/dev-user.guard.js";
import { ChallengesController } from "./challenges.controller.js";
import { LiveVersions } from "./live-versions.js";

@Module({
  controllers: [ChallengesController],
  providers: [LiveVersions, DevUserGuard],
  exports: [LiveVersions],
})
export class ChallengesModule {}
