import { Module } from "@nestjs/common";
import { DevUserGuard } from "../auth/dev-user.guard.js";
import { ChallengesModule } from "../challenges/challenges.module.js";
import { EngineClient } from "../engine/engine-client.js";
import { AttachTokens } from "./attach-token.js";
import { AttemptReader } from "./attempt-reader.js";
import { AttemptStatusUpdates } from "./attempt-status.js";
import { AttemptsController } from "./attempts.controller.js";
import { AttemptsService } from "./attempts.service.js";
import { ChecksService } from "./checks.service.js";
import { SandboxRequests } from "./sandbox-requests.js";
import { StatusConsumer } from "./status-consumer.js";

@Module({
  imports: [ChallengesModule],
  controllers: [AttemptsController],
  providers: [
    AttemptsService,
    AttemptReader,
    SandboxRequests,
    ChecksService,
    EngineClient,
    AttachTokens,
    AttemptStatusUpdates,
    StatusConsumer,
    DevUserGuard,
  ],
})
export class AttemptsModule {}
