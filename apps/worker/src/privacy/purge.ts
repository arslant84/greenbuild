import { setTimeout as sleep } from "node:timers/promises";
import { and, authAccounts, type Database, eq, privacyRequests, sql, users, userSettings } from "@greenbuild/db";
import { ACCOUNT_DELETION_DAYS } from "@greenbuild/shared";
import { logger } from "../logger.js";

const DAY_MS = 86_400_000;

// purgeDeletedAccounts deletes the personal data of accounts deleted ACCOUNT_DELETION_DAYS ago or more
// (architecture.md, "Права пользователя", task 50b) and completes their delete requests. The user row
// stays without personal fields, so attempts, XP and ratings remain only as anonymous game data.
export async function purgeDeletedAccounts(db: Database, now: Date): Promise<string[]> {
  const cutoff = new Date(now.getTime() - ACCOUNT_DELETION_DAYS * DAY_MS).toISOString();
  const due = await db
    .select({ userId: users.id, requestId: privacyRequests.id })
    .from(privacyRequests)
    .innerJoin(users, eq(users.id, privacyRequests.userId))
    .where(and(eq(privacyRequests.kind, "delete"), eq(privacyRequests.status, "pending"), eq(users.status, "deleted"), sql`${users.deletedAt} <= ${cutoff}`));
  for (const { userId, requestId } of due) {
    await db.transaction(async (tx) => {
      await tx.update(users).set({ handle: null, displayName: null, email: null, avatarUrl: null, country: null }).where(eq(users.id, userId));
      await tx.delete(authAccounts).where(eq(authAccounts.userId, userId));
      await tx.delete(userSettings).where(eq(userSettings.userId, userId));
      await tx.update(privacyRequests).set({ status: "completed", completedAt: new Date() }).where(eq(privacyRequests.id, requestId));
    });
  }
  if (due.length > 0) {
    logger.info("deleted the personal data of accounts", { count: due.length });
  }
  return due.map((row) => row.userId);
}

// runPrivacyPurge purges daily until signal aborts; failures are logged and the next run tries again.
export async function runPrivacyPurge(db: Database, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    try {
      await purgeDeletedAccounts(db, new Date());
    } catch (error) {
      logger.error("purge deleted accounts failed", { error });
    }
    await sleep(DAY_MS, undefined, { signal }).catch(() => undefined);
  }
}
