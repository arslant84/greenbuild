import { eq, users } from "@greenbuild/db";
import { ForbiddenError } from "@greenbuild/shared";
import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/api-token.js";
import { DatabaseClient } from "../infra/services.js";

// AdminGuard admits only users whose role is admin (architecture.md, API rules: /v1/admin needs
// role=admin). It runs after the global session guard, which has already set the user.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly database: DatabaseClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    const [row] = user ? await this.database.db.select({ role: users.role }).from(users).where(eq(users.id, user.id)) : [];
    if (row?.role !== "admin") {
      throw new ForbiddenError("Admins only");
    }
    return true;
  }
}
