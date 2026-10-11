import { randomUUID } from "node:crypto";
import { attempts, attemptSignals, auditLog, challenges, challengeVersions, cheatReviews, connect, desc, eq, outbox, users } from "@greenbuild/db";
import { describe, expect, it } from "vitest";
import { signDevUserToken } from "../auth/dev-user-token.js";
import { TEST_DEV_AUTH_SECRET, useAttemptsApp } from "../testing/attempts-app.js";

// architecture.md, task 49c: admins review flagged attempts; every decision goes to audit_log.
const app = useAttemptsApp();

async function withDatabase<T>(work: (db: ReturnType<typeof connect>["db"]) => Promise<T>): Promise<T> {
  const connection = connect(app().env.DATABASE_URL);
  try {
    return await work(connection.db);
  } finally {
    await connection.close();
  }
}

async function headers(userId: string): Promise<Record<string, string>> {
  return { authorization: `Bearer ${await signDevUserToken(TEST_DEV_AUTH_SECRET, userId)}`, "content-type": "application/json" };
}

async function list(userId: string): Promise<Response> {
  return fetch(`${app().baseUrl}/v1/admin/reviews`, { headers: await headers(userId) });
}

async function decide(userId: string, attemptId: string, body: unknown): Promise<Response> {
  return fetch(`${app().baseUrl}/v1/admin/reviews/${attemptId}`, { method: "POST", headers: await headers(userId), body: JSON.stringify(body) });
}

async function anAdmin(): Promise<string> {
  return withDatabase(async (db) => (await db.insert(users).values({ role: "admin" }).returning())[0]?.id ?? "");
}

async function nginxVersion(db: ReturnType<typeof connect>["db"]): Promise<string> {
  const [version] = await db
    .select({ id: challengeVersions.id })
    .from(challengeVersions)
    .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
    .where(eq(challenges.slug, "nginx-502-upstream"))
    .orderBy(desc(challengeVersions.version))
    .limit(1);
  return version?.id ?? "";
}

// aFlaggedAttempt is a solved nginx-502 attempt the worker flagged for no_exploration.
async function aFlaggedAttempt(): Promise<{ attemptId: string; userId: string }> {
  return withDatabase(async (db) => {
    const [user] = await db.insert(users).values({}).returning();
    const values = { userId: user?.id ?? "", challengeVersionId: await nginxVersion(db), seed: 1, context: "catalog" as const, status: "solved" as const };
    const [attempt] = await db.insert(attempts).values({ ...values, flagged: true, startedAt: new Date(), finishedAt: new Date(), checksUsed: 1 }).returning();
    await db.insert(attemptSignals).values({ attemptId: attempt?.id ?? "", signal: "no_exploration", value: 1, weight: 3 });
    return { attemptId: attempt?.id ?? "", userId: user?.id ?? "" };
  });
}

describe("admin reviews", () => {
  it("answers 403 to a player who is not an admin", async () => {
    expect((await list(randomUUID())).status).toBe(403);
  });

  it("lists flagged attempts with their signals", async () => {
    const { attemptId } = await aFlaggedAttempt();
    const body = (await (await list(await anAdmin())).json()) as { attempts: { attempt_id: string; signals: unknown[] }[] };

    expect(body.attempts.find((attempt) => attempt.attempt_id === attemptId)?.signals).toEqual([{ signal: "no_exploration", value: 1, weight: 3 }]);
  });

  it("clears an attempt: unflags it, sends it back to be rated and audits the decision", async () => {
    const admin = await anAdmin();
    const { attemptId } = await aFlaggedAttempt();

    expect(await (await decide(admin, attemptId, { decision: "clear", note: "pasted from own notes" })).json()).toEqual({ attempt_id: attemptId, decision: "clear" });
    await withDatabase(async (db) => {
      expect((await db.select().from(attempts).where(eq(attempts.id, attemptId)))[0]?.flagged).toBe(false);
      expect((await db.select().from(auditLog).where(eq(auditLog.targetId, attemptId)))[0]).toMatchObject({ actorId: admin, action: "review.clear", details: { note: "pasted from own notes" } });
      const events = await db.select().from(outbox);
      expect(events.some((event) => (event.payload as { attempt_id?: string }).attempt_id === attemptId)).toBe(true);
    });
  });

  it("voids once and refuses a second decision with 409; a ban bans the account", async () => {
    const admin = await anAdmin();
    const voided = await aFlaggedAttempt();
    const banned = await aFlaggedAttempt();

    expect((await decide(admin, voided.attemptId, { decision: "void" })).status).toBe(201);
    expect((await decide(admin, voided.attemptId, { decision: "clear" })).status).toBe(409);
    await decide(admin, banned.attemptId, { decision: "ban" });
    await withDatabase(async (db) => {
      expect((await db.select().from(users).where(eq(users.id, banned.userId)))[0]?.status).toBe("banned");
      expect(await db.select().from(cheatReviews).where(eq(cheatReviews.attemptId, voided.attemptId))).toHaveLength(1);
    });
  });

  it("rejects an unknown decision with 400", async () => {
    const { attemptId } = await aFlaggedAttempt();

    expect((await decide(await anAdmin(), attemptId, { decision: "forgive" })).status).toBe(400);
  });
});
