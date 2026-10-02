import { Module } from "@nestjs/common";
import { DevUserGuard } from "../auth/dev-user.guard.js";
import { EngineClient } from "../engine/engine-client.js";
import { AttachTokens } from "./attach-token.js";
import { AttemptStatusUpdates } from "./attempt-status.js";
import { AttemptsController } from "./attempts.controller.js";
import { AttemptsService } from "./attempts.service.js";
import { ChecksService } from "./checks.service.js";
import { StatusConsumer } from "./status-consumer.js";

@Module({
  controllers: [AttemptsController],
  providers: [AttemptsService, ChecksService, EngineClient, AttachTokens, AttemptStatusUpdates, StatusConsumer, DevUserGuard],
})
export class AttemptsModule {}
