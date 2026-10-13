import { and, eq, inArray, privacyRequests, sql, users } from "@greenbuild/db";
import { EXPORT_LINK_DAYS, type ExportRequestResponse, NotFoundError } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient } from "../infra/services.js";
import { ExportArchives } from "./export-archives.js";

const DAY_MS = 86_400_000;

export interface ExportDownload {
  filename: string;
  archive: Buffer;
}

// DataExport answers POST /v1/me/export (architecture.md, "Права пользователя", task 50a): it records an
// export request, which the worker turns into an archive and emails as a link. While one is still
// open, asking again answers that one; the user row is locked, so two requests at once make one.
// GET /v1/me/export/{id} answers the archive to its owner while the link is valid.
@Injectable()
export class DataExport {
  constructor(
    private readonly database: DatabaseClient,
    private readonly archives: ExportArchives,
  ) {}

  // download answers 404 for anything but the owner's completed export within EXPORT_LINK_DAYS of its
  // email, so a link reveals nothing about other players' requests.
  async download(userId: string, requestId: string, now: Date): Promise<ExportDownload> {
    const validFrom = new Date(now.getTime() - EXPORT_LINK_DAYS * DAY_MS).toISOString();
    const [request] = await this.database.db
      .select({ artifactRef: privacyRequests.artifactRef, completedAt: privacyRequests.completedAt })
      .from(privacyRequests)
      .where(
        and(
          eq(privacyRequests.id, requestId),
          eq(privacyRequests.userId, userId),
          eq(privacyRequests.kind, "export"),
          eq(privacyRequests.status, "completed"),
          sql`${privacyRequests.completedAt} >= ${validFrom}`,
        ),
      );
    if (!request?.artifactRef || !request.completedAt) {
      throw new NotFoundError("No data export with this id, or its link has expired");
    }
    const day = request.completedAt.toISOString().slice(0, 10);
    return { filename: `greenbuild-export-${day}.json`, archive: await this.archives.read(request.artifactRef) };
  }

  async request(userId: string): Promise<ExportRequestResponse> {
    const request = await this.database.db.transaction(async (tx) => {
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
      const [open] = await tx
        .select()
        .from(privacyRequests)
        .where(and(eq(privacyRequests.userId, userId), eq(privacyRequests.kind, "export"), inArray(privacyRequests.status, ["pending", "processing"])));
      if (open) {
        return open;
      }
      const [created] = await tx.insert(privacyRequests).values({ userId, kind: "export" }).returning();
      if (!created) {
        throw new Error("data export: the request row was not returned");
      }
      return created;
    });
    return { request_id: request.id, requested_at: request.requestedAt.toISOString() };
  }
}
