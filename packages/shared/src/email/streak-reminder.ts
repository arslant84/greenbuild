import { STREAK_MAX_FREEZES } from "../game/streaks.js";
import { solveXp } from "../game/xp.js";
import { EMAIL_COLORS, type Email, emailHtml, emailText, escapeHtml, MONO } from "./layout.js";

const LABEL = "STREAK";
const SECONDS_PER_MINUTE = 60;

export interface ReminderChallenge {
  title: string;
  skills: string[];
  difficulty: number;
  timeLimitSec: number;
}

export interface StreakReminder {
  // The player's current streak and the freezes they hold.
  streak: number;
  freezes: number;
  // Today's daily challenge, or null when none is published.
  challenge: ReminderChallenge | null;
  // Seconds until the player's local day ends.
  secondsLeft: number;
  playUrl: string;
  settingsUrl: string;
}

// streakReminderEmail is Email 2, "Streak Reminder", of the Email Template System (8:13213; task 52): it
// goes when the player has not solved today by the hour they chose.
export function streakReminderEmail(reminder: StreakReminder): Email {
  const subject = reminder.streak > 0 ? `Day ${reminder.streak + 1}: don't break the chain` : "Today's challenge is waiting";
  const rows = [headerRow(reminder), introRows(reminder, subject), challengeRow(reminder.challenge), actionRow(reminder), freezeRow(reminder)].join("");
  return { subject, html: emailHtml({ label: LABEL, rows }), text: reminderText(reminder, subject) };
}

function intro({ streak }: StreakReminder): string {
  return streak > 0
    ? `Your streak is ${streak} ${streak === 1 ? "day" : "days"}. Solve today's challenge before midnight your time to reach ${streak + 1}.`
    : "You have not solved a challenge today. Solve today's before midnight your time to start a streak.";
}

// clock shows the time left as hh:mm.
function clock(seconds: number): string {
  const minutes = Math.max(0, Math.floor(seconds / SECONDS_PER_MINUTE));
  return `${String(Math.floor(minutes / SECONDS_PER_MINUTE)).padStart(2, "0")}:${String(minutes % SECONDS_PER_MINUTE).padStart(2, "0")}`;
}

// The XP a daily solve earns without hints, before any speed bonus.
function dailyXp(difficulty: number): number {
  return solveXp({ difficulty, hintsUsed: 0, daily: true, durationMs: null, medianDurationMs: null, newSkills: 0 }).solve;
}

function headerRow(reminder: StreakReminder): string {
  const c = EMAIL_COLORS;
  const days = reminder.streak === 1 ? "DAY" : "DAYS";
  const pill =
    reminder.streak > 0
      ? `<span style="display: inline-block; background-color: rgba(255, 198, 64, 0.15); border: 1px solid rgba(255, 198, 64, 0.3); border-radius: 9999px; padding: 4px 10px; font-family: ${MONO}; font-size: 11px; font-weight: 600; color: ${c.streak};">&#9670; ACTIVE STREAK: ${reminder.streak} ${days}</span>`
      : "";
  return `
      <tr><td style="padding-top: 24px; padding-bottom: 20px;">${pill}
        <span style="font-family: ${MONO}; font-size: 11px; color: ${c.muted}; float: right;">DAY ENDS IN ${clock(reminder.secondsLeft)}</span>
      </td></tr>`;
}

function introRows(reminder: StreakReminder, subject: string): string {
  const c = EMAIL_COLORS;
  return `
      <tr><td style="padding-bottom: 12px;"><h1 style="margin: 0; font-size: 22px; font-weight: 600; color: ${c.text}; letter-spacing: -0.015em;">${escapeHtml(subject)}</h1></td></tr>
      <tr><td style="padding-bottom: 24px;"><p style="margin: 0; font-size: 14px; line-height: 22px; color: ${c.muted};">${escapeHtml(intro(reminder))}</p></td></tr>`;
}

function challengeRow(challenge: ReminderChallenge | null): string {
  if (!challenge) {
    return "";
  }
  const c = EMAIL_COLORS;
  const chips = challenge.skills
    .map((skill) => `<span style="display: inline-block; background-color: ${c.border}; border-radius: 4px; padding: 2px 6px; font-family: ${MONO}; font-size: 11px; color: ${c.text}; margin-right: 6px;">${escapeHtml(skill)}</span>`)
    .join("");
  return `
      <tr><td style="background-color: ${c.panel}; border-radius: 12px; border: 1px solid ${c.border}; padding: 20px;">
        <span style="font-family: ${MONO}; font-size: 10px; color: ${c.muted}; text-transform: uppercase;">Today's challenge</span>
        <span style="font-family: ${MONO}; font-size: 10px; color: ${c.accent}; float: right;">TIME LIMIT: ${Math.round(challenge.timeLimitSec / SECONDS_PER_MINUTE)} MIN</span>
        <h2 style="margin: 8px 0 12px; font-size: 16px; font-weight: 600; color: ${c.text};">${escapeHtml(challenge.title)}</h2>
        <div style="padding-bottom: 16px;">${chips}</div>
        <div style="padding-top: 10px; border-top: 1px solid ${c.border}; font-family: ${MONO}; font-size: 11px; color: ${c.muted};">
          Difficulty: <span style="color: ${c.streak};">${challenge.difficulty} / 10</span>
          <span style="color: ${c.ok}; float: right;">+${dailyXp(challenge.difficulty)} XP without hints</span>
        </div>
      </td></tr>`;
}

function actionRow({ playUrl }: StreakReminder): string {
  const c = EMAIL_COLORS;
  return `
      <tr><td style="padding-top: 24px; padding-bottom: 12px;">
        <a href="${escapeHtml(playUrl)}" target="_blank" style="display: inline-block; background-color: ${c.accent}; color: ${c.onAccent}; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px;">Solve today's challenge &rarr;</a>
      </td></tr>`;
}

function freezeRow({ freezes, settingsUrl }: StreakReminder): string {
  const c = EMAIL_COLORS;
  return `
      <tr><td style="padding-top: 20px; padding-bottom: 20px; font-family: ${MONO}; font-size: 10px; line-height: 15px; color: ${c.muted};">
        Streak freezes available: ${freezes} of ${STREAK_MAX_FREEZES}. A freeze covers a missed day when you solve again.<br>
        You get this because you turned on streak reminders. <a href="${escapeHtml(settingsUrl)}" style="color: ${c.muted};">Turn them off</a>.
      </td></tr>`;
}

function reminderText(reminder: StreakReminder, subject: string): string {
  const { challenge } = reminder;
  const challengeLines = challenge
    ? ["TODAY'S CHALLENGE:", challenge.title, `Skills: ${challenge.skills.join(", ")}`, `Difficulty: ${challenge.difficulty} / 10`, ""]
    : [];
  return emailText({
    label: LABEL,
    lines: [subject, intro(reminder), `Your day ends in ${clock(reminder.secondsLeft)}.`, "", ...challengeLines, "SOLVE IT:", reminder.playUrl, "", `Turn reminders off: ${reminder.settingsUrl}`],
  });
}
