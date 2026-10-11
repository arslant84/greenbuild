import { randomUUID } from "node:crypto";
import { challenges, challengeVersions, connect, eq } from "@greenbuild/db";
import { describe, expect, it } from "vitest";
import { player, useAttemptsApp } from "../testing/attempts-app.js";
import { NGINX_502 } from "../testing/engine-status.js";

// architecture.md, task 49d: a challenge whose newest version was retired as leaked is not served until
// a newer version is published.
const app = useAttemptsApp();

async function retireNginx502(): Promise<void> {
  const connection = connect(app().env.DATABASE_URL);
  try {
    const [challenge] = await connection.db.select({ id: challenges.id }).from(challenges).where(eq(challenges.slug, NGINX_502.challenge_slug));
    await connection.db.update(challengeVersions).set({ retiredReason: "leak_suspected" }).where(eq(challengeVersions.challengeId, challenge?.id ?? ""));
  } finally {
    await connection.close();
  }
}

describe("a retired challenge version", () => {
  it("is not shown, started or listed", async () => {
    const user = await player(app, randomUUID());
    expect((await user.card(NGINX_502.challenge_slug)).status).toBe(200);

    await retireNginx502();
    expect((await user.card(NGINX_502.challenge_slug)).status).toBe(404);
    expect((await user.start(NGINX_502)).status).toBe(404);
    const catalog = (await (await user.catalog("?limit=50")).json()) as { challenges: { slug: string }[] };
    expect(catalog.challenges.map((challenge) => challenge.slug)).not.toContain(NGINX_502.challenge_slug);
    expect(catalog.challenges.length).toBeGreaterThan(0);
  });
});
