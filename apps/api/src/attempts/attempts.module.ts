import { Module } from "@nestjs/common";
import { DevUserGuard } from "../auth/dev-user.guard.js";
import { AttemptsController } from "./attempts.controller.js";
import { AttemptsService } from "./attempts.service.js";

@Module({
  controllers: [AttemptsController],
  providers: [AttemptsService, DevUserGuard],
})
export class AttemptsModule {}
