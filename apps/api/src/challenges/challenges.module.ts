import { Module } from "@nestjs/common";
import { Catalog } from "./catalog.js";
import { ChallengesController } from "./challenges.controller.js";
import { DailyController } from "./daily.controller.js";
import { DailyChallenges } from "./daily.js";
import { LiveVersions } from "./live-versions.js";

@Module({
  controllers: [ChallengesController, DailyController],
  providers: [LiveVersions, Catalog, DailyChallenges],
  exports: [LiveVersions],
})
export class ChallengesModule {}
