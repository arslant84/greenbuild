import { and, consents, type Database, eq, sql, users, userSettings } from "@greenbuild/db";
import { DISCOVERY_CONSENT_VERSION, type DiscoveryRequest, type DiscoveryResponse, NotFoundError, UnprocessableError } from "@greenbuild/shared";
import { Injectable } from "@nestjs/common";
import { DatabaseClient } from "../infra/services.js";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

// Discovery sets whether companies may find the player (architecture.md, task 47a). Leaving hidden
// needs the 18+ confirmation and records consent to the discovery terms; going back to hidden revokes
// it. The history stays in consents.
@Injectable()
export class Discovery {
  constructor(private readonly database: DatabaseClient) {}

  async set(userId: string, request: DiscoveryRequest): Promise<DiscoveryResponse> {
    return this.database.db.transaction(async (tx) => {
      const confirmed = await confirmAge(tx, userId, request);
      const [before] = await tx.select({ mode: userSettings.discoveryMode }).from(userSettings).where(eq(userSettings.userId, userId));
      const revealedFields = await saveSettings(tx, userId, request);
      await recordConsent(tx, userId, { wasFindable: (before?.mode ?? "hidden") !== "hidden", isFindable: request.mode !== "hidden" });
      return { mode: request.mode, revealed_fields: revealedFields, age_confirmed_18: confirmed };
    });
  }
}

// confirmAge refuses a findable mode without the 18+ confirmation, records a new confirmation, and
// reports whether the player has confirmed.
async function confirmAge(tx: Transaction, userId: string, request: DiscoveryRequest): Promise<boolean> {
  const [user] = await tx.select({ ageConfirmed18At: users.ageConfirmed18At }).from(users).where(eq(users.id, userId)).for("update");
  if (!user) {
    throw new NotFoundError("User not found");
  }
  const confirmed = user.ageConfirmed18At !== null || request.confirm_18 === true;
  if (request.mode !== "hidden" && !confirmed) {
    throw new UnprocessableError("Confirm you are 18 or older to be found by companies");
  }
  if (user.ageConfirmed18At === null && request.confirm_18) {
    await tx.update(users).set({ ageConfirmed18At: new Date() }).where(eq(users.id, userId));
  }
  return confirmed;
}

// saveSettings stores the mode, and the revealed fields when given; it returns the fields now shared.
async function saveSettings(tx: Transaction, userId: string, request: DiscoveryRequest): Promise<DiscoveryResponse["revealed_fields"]> {
  const fields = request.revealed_fields ? { revealedFields: request.revealed_fields } : {};
  const [settings] = await tx
    .insert(userSettings)
    .values({ userId, discoveryMode: request.mode, ...fields })
    .onConflictDoUpdate({ target: userSettings.userId, set: { discoveryMode: request.mode, ...fields } })
    .returning();
  return settings?.revealedFields ?? [];
}

interface ModeChange {
  wasFindable: boolean;
  isFindable: boolean;
}

// recordConsent grants the discovery consent when the player becomes findable and revokes it when they
// hide again; staying on either side changes nothing.
async function recordConsent(tx: Transaction, userId: string, { wasFindable, isFindable }: ModeChange): Promise<void> {
  if (!wasFindable && isFindable) {
    await tx.insert(consents).values({ userId, kind: "discovery", version: DISCOVERY_CONSENT_VERSION });
  }
  if (wasFindable && !isFindable) {
    await tx
      .update(consents)
      .set({ revokedAt: new Date() })
      .where(and(eq(consents.userId, userId), eq(consents.kind, "discovery"), sql`${consents.revokedAt} is null`));
  }
}
