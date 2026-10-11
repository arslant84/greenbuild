import { Module } from "@nestjs/common";
import { LeaderboardsController } from "./leaderboards.controller.js";
import { Leaderboards } from "./leaderboards.js";

// The worker keeps the boards in Redis (task 45a); the API reads them (task 45b).
@Module({ controllers: [LeaderboardsController], providers: [Leaderboards] })
export class LeaderboardsModule {}
