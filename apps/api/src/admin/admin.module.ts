import { Module } from "@nestjs/common";
import { AttemptsModule } from "../attempts/attempts.module.js";
import { AdminGuard } from "./admin.guard.js";
import { Reviews } from "./reviews.js";
import { ReviewsController } from "./reviews.controller.js";

// /v1/admin: role=admin only, every action in audit_log (architecture.md, API rules).
@Module({ imports: [AttemptsModule], controllers: [ReviewsController], providers: [Reviews, AdminGuard] })
export class AdminModule {}
