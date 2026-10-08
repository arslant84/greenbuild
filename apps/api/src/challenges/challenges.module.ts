import { Module } from "@nestjs/common";
import { Catalog } from "./catalog.js";
import { ChallengesController } from "./challenges.controller.js";
import { LiveVersions } from "./live-versions.js";

@Module({
  controllers: [ChallengesController],
  providers: [LiveVersions, Catalog],
  exports: [LiveVersions],
})
export class ChallengesModule {}
