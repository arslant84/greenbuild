import { and, consents, eq, privacyRequests, sql, users, userSettings } from "@greenbuild/db";
import { ACCOUNT_DELETION_DAYS, type DeletionResponse } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient } from "../infra/services.js";

const DAY_MS = 86_400_000;

// AccountDeletion answers DELETE /v1/me (architecture.md, "Права пользователя", task 50b): the account
// is hidden at once (status deleted, so its public profile is gone), hidden from companies, every
// consent revoked, and a delete request recorded; the worker deletes the personal data after
// ACCOUNT_DELETION_DAYS. Asking again answers the same date.
@Injectable()
export class AccountDeletion {
  constructor(private readonly database: DatabaseClient) {}

  async request(userId: string): Promise<DeletionResponse> {
    const deletedAt = await this.database.db.transaction(async (tx) => {
      const [user] = await tx
        .update(users)
        .set({ status: "deleted", deletedAt: sql`coalesce(${users.deletedAt}, now())` })
        .where(eq(users.id, userId))
        .returning({ deletedAt: users.deletedAt });
      await tx.update(userSettings).set({ discoveryMode: "hidden" }).where(eq(userSettings.userId, userId));
      await tx.update(consents).set({ revokedAt: new Date() }).where(and(eq(consents.userId, userId), sql`${consents.revokedAt} is null`));
      const [open] = await tx
        .select({ id: privacyRequests.id })
        .from(privacyRequests)
        .where(and(eq(privacyRequests.userId, userId), eq(privacyRequests.kind, "delete"), eq(privacyRequests.status, "pending")));
      if (!open) {
        await tx.insert(privacyRequests).values({ userId, kind: "delete" });
      }
      return user?.deletedAt ?? new Date();
    });
    return { deletion_scheduled_for: new Date(deletedAt.getTime() + ACCOUNT_DELETION_DAYS * DAY_MS).toISOString() };
  }
}
