import { and, eq, inArray, privacyRequests, users } from "@greenbuild/db";
import type { ExportRequestResponse } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient } from "../infra/services.js";

// DataExport answers POST /v1/me/export (architecture.md, "Права пользователя", task 50a): it records an
// export request, which the worker turns into an archive and emails as a link. While one is still
// open, asking again answers that one; the user row is locked, so two requests at once make one.
@Injectable()
export class DataExport {
  constructor(private readonly database: DatabaseClient) {}

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
