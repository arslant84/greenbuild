import { randomUUID } from "node:crypto";
import { applyMigrations, challenges, challengeVersions, connect, dailyChallenges, eq, seedChallenges, sql, streaks, users, userSettings } from "@greenbuild/db";
import { utcDay } from "@greenbuild/shared";
import { type Container, startContainer } from "@greenbuild/testkit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Mailer } from "../privacy/export-job.js";
import { sendDueReminders } from "./send.js";

// architecture.md, task 52: the worker emails the streak reminder in the evening, local time. 18:30 UTC is
// 19:30 in Berlin, past the default reminder hour.
const NOW = new Date("2026-12-01T18:30:00Z");
const BERLIN_TODAY = "2026-12-01";
const WEB_URL = "https://greenbuild.test";
let container: Container;
let database: ReturnType<typeof connect>;

beforeAll(async () => {
  container = await startContainer({
    image: "postgres:16-alpine",
    port: 5432,
    env: { POSTGRES_PASSWORD: "test" },
    ready: async (address) => {
      const probe = connect(`postgres://postgres:test@${address}/postgres`);
      await probe.db.execute(sql`select 1`).finally(() => probe.close());
    },
  });
  const url = `postgres://postgres:test@${container.address}/postgres`;
  await applyMigrations(url);
  database = connect(url);
  await seedChallenges(database.db);
  const [nginx] = await database.db
    .select({ id: challengeVersions.id })
    .from(challengeVersions)
    .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
    .where(eq(challenges.slug, "nginx-502-upstream"));
  await database.db.insert(dailyChallenges).values({ day: utcDay(NOW), track: "linux", challengeVersionId: nginx?.id ?? "" });
}, 120_000);

afterAll(async () => {
  await database?.close();
  await container?.stop();
});

function fakeMail(fail = false): Mailer & { sent: { to: string; subject: string; html?: string | undefined; headers?: Record<string, string> | undefined }[] } {
  const sent: { to: string; subject: string; html?: string | undefined; headers?: Record<string, string> | undefined }[] = [];
  return {
    sent,
    send: async ({ to, subject, html, headers }) => {
      if (fail) {
        throw new Error("smtp down");
      }
      sent.push({ to, subject, html, headers });
    },
  };
}

interface PlayerOptions {
  notify?: boolean;
  email?: string | null;
  ageConfirmed?: boolean;
  status?: "active" | "banned";
  solvedToday?: boolean;
}

const DEFAULT_PLAYER = { notify: true, ageConfirmed: true, status: "active" as const, solvedToday: false };

async function aPlayer(options: PlayerOptions = {}): Promise<string> {
  const { notify, ageConfirmed, status, solvedToday } = { ...DEFAULT_PLAYER, ...options };
  const email = options.email === undefined ? `${randomUUID()}@example.com` : options.email;
  const [user] = await database.db
    .insert(users)
    .values({ email, status, timezone: "Europe/Berlin", ageConfirmed16At: ageConfirmed ? new Date() : null })
    .returning();
  const userId = user?.id ?? "";
  await database.db.insert(userSettings).values({ userId, notifyEmail: notify });
  await database.db.insert(streaks).values({ userId, current: 4, longest: 4, lastDay: solvedToday ? BERLIN_TODAY : "2026-11-30", freezesAvailable: 1 });
  return email ?? "";
}

describe("sendDueReminders", () => {
  it("emails a player who has not solved today the reminder with their streak and today's challenge, once a day", async () => {
    const email = await aPlayer();
    const mail = fakeMail();

    await sendDueReminders({ db: database.db, mail, webUrl: WEB_URL }, NOW);
    const second = fakeMail();
    await sendDueReminders({ db: database.db, mail: second, webUrl: WEB_URL }, NOW);

    const mine = mail.sent.find((message) => message.to === email);
    expect(mine?.subject).toBe("Day 5: don't break the chain");
    expect(mine?.html).toContain("The site returns 502");
    expect(mine?.html).toContain(`${WEB_URL}/play`);
    expect(mine?.headers?.["List-Unsubscribe"]).toMatch(/^<https:\/\/greenbuild\.test\/api\/notifications\/unsubscribe\?token=[0-9a-f-]{36}>$/);
    expect(mine?.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(second.sent.find((message) => message.to === email)).toBeUndefined();
  });

  it.each([
    ["the reminder off", { notify: false }],
    ["no email address", { email: null }],
    ["no 16+ confirmation", { ageConfirmed: false }],
    ["a closed account", { status: "banned" as const }],
    ["a solve today", { solvedToday: true }],
  ])("sends nothing to a player with %s", async (_name, options) => {
    const email = await aPlayer(options);
    const mail = fakeMail();

    await sendDueReminders({ db: database.db, mail, webUrl: WEB_URL }, NOW);

    expect(mail.sent.filter((message) => email !== "" && message.to === email)).toEqual([]);
  });

  it("logs an email that fails and does not retry it the same day", async () => {
    const email = await aPlayer();

    await expect(sendDueReminders({ db: database.db, mail: fakeMail(true), webUrl: WEB_URL }, NOW)).resolves.toBeGreaterThanOrEqual(0);
    const retry = fakeMail();
    await sendDueReminders({ db: database.db, mail: retry, webUrl: WEB_URL }, NOW);

    expect(retry.sent.find((message) => message.to === email)).toBeUndefined();
  });
});
