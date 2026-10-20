import { setTimeout as sleep } from "node:timers/promises";
import { and, type Database, eq, privacyRequests, sql, users } from "@greenbuild/db";
import { EXPORT_LINK_DAYS } from "@greenbuild/shared";
import { logger } from "../logger.js";
import { exportArchive } from "./export.js";

const POLL_MS = 60_000;
// A request still processing this long after its last change was left by a worker that stopped.
const STALE_PROCESSING_MS = 60 * 60_000;

// ArchiveStore keeps export archives (Blob Storage; a fake in tests).
export interface ArchiveStore {
  put(name: string, json: string): Promise<void>;
}

// Mailer sends one plain-text email (SMTP; a fake in tests).
export interface Mailer {
  // html and headers are optional: the plain-text part always goes.
  send(message: { to: string; subject: string; text: string; html?: string; headers?: Record<string, string> }): Promise<void>;
}

export interface ExportDeps {
  db: Database;
  archives: ArchiveStore;
  mail: Mailer;
  // The web app's address; the emailed link opens there, for the signed-in owner only.
  webUrl: string;
}

interface Claimed {
  requestId: string;
  userId: string;
  email: string | null;
}

// processExportRequests turns pending export requests into archives (architecture.md, "Права
// пользователя", task 50a): it stores each archive and emails its owner a link, then completes the
// request; a player without an email cannot get the link, so their request is rejected. Each request
// is claimed with SKIP LOCKED, so two workers never take the same one; one that fails goes back to
// pending, and one left processing by a stopped worker is taken again after an hour. Answers how
// many it handled.
export async function processExportRequests(deps: ExportDeps, now: Date): Promise<number> {
  let handled = 0;
  for (;;) {
    const claimed = await claimNext(deps.db, now);
    if (!claimed) {
      return handled;
    }
    try {
      await deliver(deps, claimed, now);
    } catch (error) {
      await deps.db.update(privacyRequests).set({ status: "pending" }).where(eq(privacyRequests.id, claimed.requestId));
      throw error;
    }
    handled += 1;
  }
}

async function claimNext(db: Database, now: Date): Promise<Claimed | undefined> {
  const stale = new Date(now.getTime() - STALE_PROCESSING_MS).toISOString();
  return db.transaction(async (tx) => {
    const [next] = await tx
      .select({ requestId: privacyRequests.id, userId: privacyRequests.userId, email: users.email })
      .from(privacyRequests)
      .innerJoin(users, eq(users.id, privacyRequests.userId))
      .where(
        and(
          eq(privacyRequests.kind, "export"),
          sql`(${privacyRequests.status} = 'pending' or (${privacyRequests.status} = 'processing' and ${privacyRequests.updatedAt} < ${stale}))`,
        ),
      )
      .orderBy(privacyRequests.requestedAt)
      .limit(1)
      .for("update", { of: privacyRequests, skipLocked: true });
    if (next) {
      await tx.update(privacyRequests).set({ status: "processing" }).where(eq(privacyRequests.id, next.requestId));
    }
    return next;
  });
}

async function deliver(deps: ExportDeps, { requestId, userId, email }: Claimed, now: Date): Promise<void> {
  const done = (status: "completed" | "rejected", artifactRef: string | null) =>
    deps.db.update(privacyRequests).set({ status, completedAt: now, artifactRef }).where(eq(privacyRequests.id, requestId));
  if (!email) {
    await done("rejected", null);
    return;
  }
  const name = `${requestId}.json`;
  await deps.archives.put(name, JSON.stringify(await exportArchive(deps.db, userId, now), null, 2));
  await deps.mail.send({
    to: email,
    subject: "Your greenbuild data export",
    text: `Your data export is ready. Download it while signed in to greenbuild:\n${deps.webUrl}/api/me/export/${requestId}\n\nThe link works for ${EXPORT_LINK_DAYS} days.\n`,
  });
  await done("completed", name);
}

// runDataExports handles export requests every minute until signal aborts; a failure is logged without
// the player's data, and the next run tries the request again.
export async function runDataExports(deps: ExportDeps, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    try {
      await processExportRequests(deps, new Date());
    } catch (error) {
      logger.error("data export failed", { error });
    }
    await sleep(POLL_MS, undefined, { signal }).catch(() => undefined);
  }
}
