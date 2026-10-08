import { Module } from "@nestjs/common";
import { ChallengesController } from "./challenges.controller.js";
import { LiveVersions } from "./live-versions.js";

@Module({
  controllers: [ChallengesController],
  providers: [LiveVersions],
  exports: [LiveVersions],
})
export class ChallengesModule {}
