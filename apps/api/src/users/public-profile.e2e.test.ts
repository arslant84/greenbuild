import { randomUUID } from "node:crypto";
import { attempts, challenges, challengeVersions, connect, desc, eq, users, userSettings, userSkills, xpLedger } from "@greenbuild/db";
import { describe, expect, it } from "vitest";
import { useAttemptsApp } from "../testing/attempts-app.js";

// architecture.md, task 46a: GET /v1/users/{handle} is public and answers only for a public game
// profile; ratings come with their 95% interval.
const app = useAttemptsApp();

function profile(handle: string): Promise<Response> {
  return fetch(`${app().baseUrl}/v1/users/${handle}`);
}

// aPlayer adds a player with one solved nginx-502 attempt worth 150 XP and a linux rating of 1600 ± 100.
async function aPlayer(handle: string, isPublic = true): Promise<void> {
  const connection = connect(app().env.DATABASE_URL);
  try {
    const { db } = connection;
    const [user] = await db.insert(users).values({ handle, displayName: "Ada" }).returning();
    const userId = user?.id ?? "";
    if (!isPublic) {
      await db.insert(userSettings).values({ userId, gameProfilePublic: false });
    }
    const [version] = await db
      .select({ id: challengeVersions.id })
      .from(challengeVersions)
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .where(eq(challenges.slug, "nginx-502-upstream"))
      .orderBy(desc(challengeVersions.version))
      .limit(1);
    const [attempt] = await db.insert(attempts).values({ userId, challengeVersionId: version?.id ?? "", seed: 1, context: "catalog", status: "solved" }).returning();
    await db.insert(xpLedger).values({ userId, attemptId: attempt?.id ?? "", reason: "solve", amount: 150 });
    await db.insert(userSkills).values({ userId, skill: "linux", rating: 1600, ratingDeviation: 100, attemptsCount: 1 });
  } finally {
    await connection.close();
  }
}

describe("GET /v1/users/{handle}", () => {
  it("shows a public profile without a session, with level, solves, streak and rating intervals", async () => {
    const handle = `ada-${randomUUID().slice(0, 8)}`;
    await aPlayer(handle);

    const response = await profile(handle.toUpperCase());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      handle,
      display_name: "Ada",
      level: 1,
      xp: 150,
      solved: 1,
      streak: { current: 0, longest: 0 },
      skills: [{ skill: "linux", rating: 1600, interval: [1404, 1796], attempts: 1 }],
    });
  });

  it("answers 404 for a private profile and an unknown handle alike", async () => {
    const hidden = `hid-${randomUUID().slice(0, 8)}`;
    await aPlayer(hidden, false);

    expect((await profile(hidden)).status).toBe(404);
    expect((await profile(`nobody-${randomUUID().slice(0, 8)}`)).status).toBe(404);
  });

  it("rejects a malformed handle with 400", async () => {
    expect((await profile("no%20spaces")).status).toBe(400);
  });
});
