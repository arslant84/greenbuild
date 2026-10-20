import { and, challenges, challengeVersions, dailyChallenges, type Database, eq, isNotNull, isNull, ne, or, streaks, users, userSettings } from "@greenbuild/db";
import { DAILY_TRACKS, localDay, NO_STREAK, type ReminderChallenge, streakReminderEmail, utcDay, visibleStreak } from "@greenbuild/shared";
import { z } from "zod";
import { logger } from "../logger.js";
import type { Mailer } from "../privacy/export-job.js";
import { type ReminderCandidate, reminderDue, secondsLeftInDay } from "./due.js";

export interface ReminderDeps {
  db: Database;
  mail: Mailer;
  webUrl: string;
}

// The parts of a challenge manifest the reminder shows.
const reminderSpecSchema = z.object({ skills: z.record(z.string(), z.number()), time_limit_sec: z.number() });

// sendDueReminders emails the streak reminder (task 52) to every player it is due for now, and answers
// how many went. Each player's day is claimed before the email, so two workers never send it twice; an
// email that fails is logged and not retried that day.
export async function sendDueReminders({ db, mail, webUrl }: ReminderDeps, now: Date): Promise<number> {
  const due = (await reminderCandidates(db)).filter((candidate) => reminderDue(candidate, now));
  if (due.length === 0) {
    return 0;
  }
  const challenge = await todaysChallenge(db, now);
  let sent = 0;
  for (const candidate of due) {
    if (!(await claimDay(db, candidate, localDay(now, candidate.timezone)))) {
      continue;
    }
    const email = streakReminderEmail({
      streak: visibleStreak(candidate.streak, localDay(now, candidate.timezone)),
      freezes: candidate.streak.freezes,
      challenge,
      secondsLeft: secondsLeftInDay(now, candidate.timezone),
      playUrl: `${webUrl}/play`,
      settingsUrl: `${webUrl}/settings#section-notifications`,
    });
    try {
      await mail.send({ to: candidate.email, ...email, headers: unsubscribeHeaders(webUrl, candidate.unsubscribeToken) });
      sent += 1;
    } catch (error) {
      logger.error("streak reminder not sent", { userId: candidate.userId, error });
    }
  }
  return sent;
}

// unsubscribeHeaders let mail providers offer one-click unsubscribe (RFC 8058): they POST to the URL.
export function unsubscribeHeaders(webUrl: string, token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${webUrl}/api/notifications/unsubscribe?token=${encodeURIComponent(token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// reminderCandidates are the active players with an address, confirmed 16+, who turned the reminder on.
async function reminderCandidates(db: Database): Promise<ReminderCandidate[]> {
  const rows = await db
    .select({ user: users, settings: userSettings, streak: streaks })
    .from(userSettings)
    .innerJoin(users, eq(users.id, userSettings.userId))
    .leftJoin(streaks, eq(streaks.userId, users.id))
    .where(and(eq(userSettings.notifyEmail, true), eq(users.status, "active"), isNotNull(users.email), isNotNull(users.ageConfirmed16At)));
  return rows.map(({ user, settings, streak }) => ({
    userId: user.id,
    email: user.email ?? "",
    timezone: user.timezone,
    reminderHour: settings.reminderHour,
    lastRemindedDay: settings.lastRemindedDay,
    unsubscribeToken: settings.unsubscribeToken,
    streak: streak ? { current: streak.current, longest: streak.longest, lastDay: streak.lastDay, freezes: streak.freezesAvailable } : NO_STREAK,
  }));
}

// claimDay records today's reminder for the player, unless it is already recorded.
async function claimDay(db: Database, candidate: ReminderCandidate, today: string): Promise<boolean> {
  const claimed = await db
    .update(userSettings)
    .set({ lastRemindedDay: today })
    .where(and(eq(userSettings.userId, candidate.userId), or(isNull(userSettings.lastRemindedDay), ne(userSettings.lastRemindedDay, today))))
    .returning({ userId: userSettings.userId });
  return claimed.length > 0;
}

// todaysChallenge is the daily challenge published for today (UTC, task 41a), or null.
async function todaysChallenge(db: Database, now: Date): Promise<ReminderChallenge | null> {
  const [row] = await db
    .select({ title: challenges.title, difficulty: challenges.difficulty, spec: challengeVersions.specJson })
    .from(dailyChallenges)
    .innerJoin(challengeVersions, eq(challengeVersions.id, dailyChallenges.challengeVersionId))
    .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
    .where(and(eq(dailyChallenges.day, utcDay(now)), eq(dailyChallenges.track, DAILY_TRACKS[0])));
  const spec = reminderSpecSchema.safeParse(row?.spec);
  if (!row || !spec.success) {
    return null;
  }
  return { title: row.title, skills: Object.keys(spec.data.skills), difficulty: row.difficulty, timeLimitSec: spec.data.time_limit_sec };
}
