import { randomUUID } from "node:crypto";
import { connect, eq, users } from "@greenbuild/db";
import type { ShareCard, ShareCreated } from "@greenbuild/shared";
import { describe, expect, it } from "vitest";
import { type AttemptsApp, type Player, player, useAttemptsApp } from "../testing/attempts-app.js";
import { readyAttempt } from "../testing/engine-status.js";

// architecture.md, task 51: a solved attempt's share link, its public card, and revoking it.
const PASSED = { status: 200, body: { passed: true, output_tail: "the site is back\n", duration_ms: 120 } };

async function solvedAttempt(app: () => AttemptsApp, user: Player): Promise<string> {
  const id = await readyAttempt(app, user);
  app().engine.answers.push(PASSED);
  await user.check(id);
  return id;
}

async function tokenFor(user: Player, id: string): Promise<string> {
  const response = await user.share(id);
  expect(response.status).toBe(200);
  return ((await response.json()) as ShareCreated).token;
}

// publicCard reads the card as a visitor: no session.
function publicCard(app: () => AttemptsApp, token: string): Promise<Response> {
  return fetch(`${app().baseUrl}/v1/share/${token}`);
}

describe("share cards", () => {
  const app = useAttemptsApp();

  it("gives a solved attempt one link, whose card anyone can read", async () => {
    const user = await player(app, randomUUID());
    const id = await solvedAttempt(app, user);
    const token = await tokenFor(user, id);
    expect(await tokenFor(user, id)).toBe(token);

    const response = await publicCard(app, token);
    expect(response.status).toBe(200);
    const card = (await response.json()) as ShareCard;
    expect(card).toMatchObject({ challenge_title: "The site returns 502", skills: ["linux", "nginx"], checks_passed: 1, checks_used: 1, xp_earned: null, streak: 0 });
    expect(JSON.stringify(card)).not.toContain(id);
  });

  it("answers 404 once the link is revoked, and a new share makes a new link", async () => {
    const user = await player(app, randomUUID());
    const id = await solvedAttempt(app, user);
    const token = await tokenFor(user, id);

    expect((await user.unshare(id)).status).toBe(204);
    expect((await publicCard(app, token)).status).toBe(404);
    expect(await tokenFor(user, id)).not.toBe(token);
  });

  it("refuses an unsolved attempt with 409 and someone else's with 404", async () => {
    const user = await player(app, randomUUID());
    const running = await readyAttempt(app, user);
    expect((await user.share(running)).status).toBe(409);
    expect((await (await player(app, randomUUID())).share(running)).status).toBe(404);
  });

  it("hides the card of a banned player", async () => {
    const user = await player(app, randomUUID());
    const token = await tokenFor(user, await solvedAttempt(app, user));
    const connection = connect(app().env.DATABASE_URL);
    await connection.db.update(users).set({ status: "banned" }).where(eq(users.id, user.userId));
    await connection.close();

    expect((await publicCard(app, token)).status).toBe(404);
  });
});
