import { eq, users } from "@greenbuild/db";
import { ForbiddenError, UnauthorizedError } from "@greenbuild/shared";
import { type CanActivate, createParamDecorator, type ExecutionContext, Inject, Injectable, Optional } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ServicesEnv } from "../config/services-env.js";
import { DatabaseClient, SERVICES_ENV } from "../infra/services.js";
import { type AuthenticatedUser, verifyDevUserToken } from "./dev-user-token.js";
import { IS_PUBLIC } from "./public.js";

interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
}

// DevUserGuard runs on every route (AppModule) and admits only requests with a dev user token,
// unless the route is @Public(). In production, or without DEV_AUTH_SECRET (also when the API runs
// without its services), it admits nobody: the API never falls back to unauthenticated access.
@Injectable()
export class DevUserGuard implements CanActivate {
  private readonly secret: string | undefined;

  constructor(
    private readonly reflector: Reflector,
    @Optional() @Inject(SERVICES_ENV) env?: ServicesEnv,
    @Optional() private readonly database?: DatabaseClient,
  ) {
    this.secret = env?.NODE_ENV === "production" ? undefined : env?.DEV_AUTH_SECRET;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    const user = this.secret && token ? await verifyDevUserToken(this.secret, token) : null;
    if (!user) {
      throw new UnauthorizedError();
    }
    // A dev token names a user nobody created, and attempts need the users row (task 29b). Auth.js
    // creates users at sign-in (task 30a); this goes with the dev path (task 30e).
    await this.database?.db.insert(users).values({ id: user.id }).onConflictDoNothing();
    await this.refuseClosedAccount(user.id);
    request.user = user;
    return true;
  }

  // A banned or deleted account keeps no access, even with a token signed before it was closed.
  private async refuseClosedAccount(userId: string): Promise<void> {
    const [account] = (await this.database?.db.select({ status: users.status }).from(users).where(eq(users.id, userId))) ?? [];
    if (account && account.status !== "active") {
      throw new ForbiddenError("This account is closed");
    }
  }
}

// CurrentUser is the user DevUserGuard admitted.
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser => {
  const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
});
