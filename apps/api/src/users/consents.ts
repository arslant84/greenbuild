import { consents, desc, eq } from "@greenbuild/db";
import type { ConsentHistory } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient } from "../infra/services.js";

// Consents answers GET /v1/me/consents: the player's consent history, newest first (architecture.md,
// "Права пользователя", task 50c).
@Injectable()
export class Consents {
  constructor(private readonly database: DatabaseClient) {}

  async history(userId: string): Promise<ConsentHistory> {
    const rows = await this.database.db.select().from(consents).where(eq(consents.userId, userId)).orderBy(desc(consents.grantedAt));
    return {
      consents: rows.map((row) => ({ kind: row.kind, version: row.version, granted_at: row.grantedAt.toISOString(), revoked_at: row.revokedAt?.toISOString() ?? null })),
    };
  }
}
