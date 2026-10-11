import { randomUUID } from "node:crypto";
import { attempts, challenges, challengeVersions, connect, dailyChallenges, desc, eq } from "@greenbuild/db";
import { utcDay } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { signDevUserToken } from "../auth/dev-user-token.js";
import { player, TEST_DEV_AUTH_SECRET, useAttemptsApp } from "../testing/attempts-app.js";
import { NGINX_502 } from "../testing/engine-status.js";

// architecture.md, task 41b: today's challenge for a track and the player's status on it. The worker
// is not running here, so the tests publish the day themselves.
const app = useAttemptsApp();

async function daily(userId: string, query = ""): Promise<Response> {
  const token = await signDevUserToken(TEST_DEV_AUTH_SECRET, userId);
  return fetch(`${app().baseUrl}/v1/daily${query}`, { headers: { authorization: `Bearer ${token}` } });
}

async function publishToday(slug: string): Promise<void> {
  const connection = connect(app().env.DATABASE_URL);
  try {
    const [version] = await connection.db
      .select({ id: challengeVersions.id })
      .from(challengeVersions)
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .where(eq(challenges.slug, slug))
      .orderBy(desc(challengeVersions.version))
      .limit(1);
    await connection.db.insert(dailyChallenges).values({ day: utcDay(new Date()), track: "linux", challengeVersionId: version?.id ?? "" });
  } finally {
    await connection.close();
  }
}

async function contextOf(attemptId: string): Promise<string | undefined> {
  const connection = connect(app().env.DATABASE_URL);
  try {
    const [attempt] = await connection.db.select({ context: attempts.context }).from(attempts).where(eq(attempts.id, attemptId));
    return attempt?.context;
  } finally {
    await connection.close();
  }
}

describe("GET /v1/daily", () => {
  it("answers 404 while nothing is published for today", async () => {
    const response = await daily(randomUUID());

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "not_found" });
  });

  it("rejects an unknown track with 400", async () => {
    expect((await daily(randomUUID(), "?track=azure")).status).toBe(400);
  });

  it("shows today's challenge and the player's attempt once they start it", async () => {
    await publishToday(NGINX_502.challenge_slug);
    const userId = randomUUID();

    const before = await daily(userId);
    expect(before.status).toBe(200);
    expect(await before.json()).toMatchObject({ day: utcDay(new Date()), track: "linux", challenge: { slug: NGINX_502.challenge_slug }, attempt: null });

    const started = (await (await (await player(app, userId)).start(NGINX_502)).json()) as { id: string };
    expect(await (await daily(userId)).json()).toMatchObject({ attempt: { id: started.id, status: "starting" } });
    expect(await (await daily(randomUUID())).json()).toMatchObject({ attempt: null });
  });
});

// Task 42a: the server marks an attempt at today's daily challenge as daily (x1.5 XP); the client cannot.
describe("starting an attempt", () => {
  it("records today's daily challenge as daily and any other as catalog", async () => {
    const daily = (await (await (await player(app, randomUUID())).start(NGINX_502)).json()) as { id: string };
    const other = (await (await (await player(app, randomUUID())).start({ challenge_slug: "app-env-renamed" })).json()) as { id: string };

    expect(await contextOf(daily.id)).toBe("daily");
    expect(await contextOf(other.id)).toBe("catalog");
  });
});
