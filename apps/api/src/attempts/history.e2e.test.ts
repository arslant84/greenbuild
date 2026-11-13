import { randomUUID } from "node:crypto";
import { attempts, challenges, challengeVersions, connect, desc, eq, xpLedger } from "@greenbuild/db";
import { attemptHistoryResponseSchema } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { player, useAttemptsApp } from "../testing/attempts-app.js";
import { NGINX_502, startedBy } from "../testing/engine-status.js";

// GET /v1/me/attempts on PostgreSQL: the player's finished attempts with the XP credited for each.
const app = useAttemptsApp();

interface Finished {
  status: "solved" | "failed" | "expired" | "abandoned";
  context: "daily" | "catalog";
  createdAt: string;
  durationMs: number | null;
  hintsUsed: number;
  xp: number[];
}

// finishedAttempt writes an attempt as the worker leaves it, with its XP rows, for the given player.
async function finishedAttempt(userId: string, attempt: Finished): Promise<string> {
  const connection = connect(app().env.DATABASE_URL);
  try {
    const [version] = await connection.db
      .select({ id: challengeVersions.id })
      .from(challengeVersions)
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .where(eq(challenges.slug, NGINX_502.challenge_slug))
      .orderBy(desc(challengeVersions.version))
      .limit(1);
    if (!version) {
      throw new Error("nginx-502 is not seeded");
    }
    const createdAt = new Date(attempt.createdAt);
    const [row] = await connection.db
      .insert(attempts)
      .values({
        userId,
        challengeVersionId: version.id,
        seed: 1,
        context: attempt.context,
        status: attempt.status,
        createdAt,
        finishedAt: new Date(createdAt.getTime() + 600_000),
        durationMs: attempt.durationMs,
        hintsUsed: attempt.hintsUsed,
      })
      .returning({ id: attempts.id });
    if (!row) {
      throw new Error("attempt not inserted");
    }
    const reasons = ["solve", "new_skills"] as const;
    for (const [index, amount] of attempt.xp.entries()) {
      await connection.db.insert(xpLedger).values({ userId, attemptId: row.id, amount, reason: reasons[index] ?? "solve" });
    }
    return row.id;
  } finally {
    await connection.close();
  }
}

// newPlayersHistory asks for the history of a player who has no attempts.
async function newPlayersHistory(query: string): Promise<Response> {
  return (await player(app, randomUUID())).history(query);
}

// listsNewestFirst: two finished attempts of one player, another player's, and a running one.
async function listsNewestFirst(): Promise<void> {
  const user = await player(app, randomUUID());
  const older = await finishedAttempt(user.userId, { status: "failed", context: "catalog", createdAt: "2026-11-10T09:00:00Z", durationMs: 900_000, hintsUsed: 2, xp: [] });
  const newer = await finishedAttempt(user.userId, { status: "solved", context: "daily", createdAt: "2026-11-12T08:00:00Z", durationMs: 255_000, hintsUsed: 0, xp: [150, 30] });
  await finishedAttempt((await player(app, randomUUID())).userId, { status: "solved", context: "daily", createdAt: "2026-11-12T08:00:00Z", durationMs: 1, hintsUsed: 0, xp: [10] });
  await startedBy(user);

  const response = await user.history("");
  expect(response.status).toBe(200);
  const body = attemptHistoryResponseSchema.parse(await response.json());
  expect(body.attempts.map((attempt) => attempt.id)).toEqual([newer, older]);
  expect(body.attempts[0]).toMatchObject({
    challenge_slug: "nginx-502-upstream",
    challenge_title: "The site returns 502",
    context: "daily",
    status: "solved",
    created_at: "2026-11-12T08:00:00.000Z",
    duration_ms: 255_000,
    hints_used: 0,
    xp_earned: 180,
  });
  expect(body.attempts[1]).toMatchObject({ status: "failed", context: "catalog", hints_used: 2, xp_earned: 0 });
}

describe("GET /v1/me/attempts", () => {
  it("lists the player's finished attempts newest first, with the title, time, hints and XP earned", () => listsNewestFirst());

  it("answers at most limit attempts", async () => {
    const user = await player(app, randomUUID());
    for (const day of ["01", "02", "03"]) {
      await finishedAttempt(user.userId, { status: "abandoned", context: "catalog", createdAt: `2026-11-${day}T10:00:00Z`, durationMs: null, hintsUsed: 0, xp: [] });
    }

    const body = attemptHistoryResponseSchema.parse(await (await user.history("?limit=2")).json());
    expect(body.attempts.map((attempt) => attempt.created_at)).toEqual(["2026-11-03T10:00:00.000Z", "2026-11-02T10:00:00.000Z"]);
  });

  it("answers an empty list to a player who has finished nothing", async () => {
    expect(await (await newPlayersHistory("")).json()).toEqual({ attempts: [] });
  });

  it.each([
    ["a limit of 0", "?limit=0"],
    ["a limit above 50", "?limit=51"],
    ["an unknown parameter", "?status=solved"],
  ])("answers %s with 400", async (_name, query) => {
    expect((await newPlayersHistory(query)).status).toBe(400);
  });

  it("refuses requests without a token", async () => {
    expect((await fetch(`${app().baseUrl}/v1/me/attempts`)).status).toBe(401);
  });
});
