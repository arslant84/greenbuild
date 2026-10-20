import { eq, users } from "@greenbuild/db";
import { AgeNotConfirmedError, ForbiddenError, UnauthorizedError } from "@greenbuild/shared";
import { type CanActivate, createParamDecorator, type ExecutionContext, Inject, Injectable, Optional } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ServicesEnv } from "../config/services-env.js";
import { DatabaseClient, SERVICES_ENV } from "../infra/services.js";
import { apiTokenKey, type AuthenticatedUser, verifyApiToken } from "./api-token.js";
import { IS_PUBLIC } from "./public.js";

interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
}

// SessionGuard runs on every route (AppModule) and admits only requests with an API token the web app
// issues for a signed-in player (task 30c), unless the route is @Public(). Without the web app's key
// (also when the API runs without its services) it admits nobody: the API never falls back to
// unauthenticated access. A banned or deleted account is refused, and so is one whose player has not
// confirmed being 16 or older (task 30b): the web app sends them to sign-in to confirm.
@Injectable()
export class SessionGuard implements CanActivate {
  private readonly apiKey: ReturnType<typeof apiTokenKey> | undefined;

  constructor(
    private readonly reflector: Reflector,
    @Optional() @Inject(SERVICES_ENV) env?: ServicesEnv,
    @Optional() private readonly database?: DatabaseClient,
  ) {
    this.apiKey = env?.API_TOKEN_PUBLIC_KEY ? apiTokenKey(env.API_TOKEN_PUBLIC_KEY) : undefined;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    const user = token ? await this.signedInUser(token) : null;
    if (!user) {
      throw new UnauthorizedError();
    }
    const account = await this.account(user.id);
    if (!account) {
      throw new UnauthorizedError();
    }
    if (account.status !== "active") {
      throw new ForbiddenError("This account is closed");
    }
    if (!account.ageConfirmed) {
      throw new AgeNotConfirmedError();
    }
    request.user = user;
    return true;
  }

  private async signedInUser(token: string): Promise<AuthenticatedUser | null> {
    return this.apiKey ? verifyApiToken(await this.apiKey, token) : null;
  }

  // account is undefined for a user without a row: a token for an account that does not exist. Without
  // the database (the guard's unit tests) every account counts as active and confirmed.
  private async account(userId: string): Promise<{ status: string; ageConfirmed: boolean } | undefined> {
    if (!this.database) {
      return { status: "active", ageConfirmed: true };
    }
    const [row] = await this.database.db
      .select({ status: users.status, ageConfirmed16At: users.ageConfirmed16At })
      .from(users)
      .where(eq(users.id, userId));
    return row && { status: row.status, ageConfirmed: row.ageConfirmed16At !== null };
  }
}

// CurrentUser is the user SessionGuard admitted.
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser => {
  const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
});
