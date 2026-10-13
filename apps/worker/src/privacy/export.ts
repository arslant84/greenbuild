import {
  assessmentInvites,
  attempts,
  attemptSignals,
  authAccounts,
  challenges,
  challengeVersions,
  cheatReviews,
  companies,
  companyMembers,
  consents,
  type Database,
  eq,
  inArray,
  privacyRequests,
  streaks,
  users,
  userSettings,
  userSkills,
  xpLedger,
} from "@greenbuild/db";

// The archive's layout version; a change to its sections raises it.
export const EXPORT_FORMAT = 1;

// exportArchive collects everything greenbuild keeps about a player (architecture.md, "Права
// пользователя", task 50a): the account, sign-in methods, settings, consent history, privacy requests,
// attempts with their anti-cheat signals and review decisions, XP, streak, skill ratings, and the
// companies that received access (assessments the player started, company memberships). It reads
// only; sending the archive is the export job's.
export async function exportArchive(db: Database, userId: string, now: Date): Promise<Record<string, unknown>> {
  const [account, signIn, settings, consentHistory, requests, played, xp, streak, skills, access] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    db.select({ provider: authAccounts.provider, linkedAt: authAccounts.createdAt }).from(authAccounts).where(eq(authAccounts.userId, userId)),
    db.select().from(userSettings).where(eq(userSettings.userId, userId)),
    db.select().from(consents).where(eq(consents.userId, userId)),
    db.select().from(privacyRequests).where(eq(privacyRequests.userId, userId)),
    attemptsOf(db, userId),
    db.select({ amount: xpLedger.amount, reason: xpLedger.reason, attemptId: xpLedger.attemptId, at: xpLedger.createdAt }).from(xpLedger).where(eq(xpLedger.userId, userId)),
    db.select().from(streaks).where(eq(streaks.userId, userId)),
    db.select().from(userSkills).where(eq(userSkills.userId, userId)),
    companiesWithAccess(db, userId),
  ]);
  return {
    format: EXPORT_FORMAT,
    exportedAt: now.toISOString(),
    account: account[0] ?? null,
    signInMethods: signIn,
    settings: settings[0] ?? null,
    consents: consentHistory,
    privacyRequests: requests,
    attempts: played,
    xp,
    streak: streak[0] ?? null,
    skills,
    companies: access,
  };
}

// attemptsOf lists the player's attempts with the challenge, the anti-cheat signals found and a review decision.
async function attemptsOf(db: Database, userId: string): Promise<Record<string, unknown>[]> {
  const rows = await db
    .select({ attempt: attempts, challenge: challenges.slug, version: challengeVersions.version, review: cheatReviews.decision })
    .from(attempts)
    .innerJoin(challengeVersions, eq(challengeVersions.id, attempts.challengeVersionId))
    .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
    .leftJoin(cheatReviews, eq(cheatReviews.attemptId, attempts.id))
    .where(eq(attempts.userId, userId));
  const ids = rows.map((row) => row.attempt.id);
  const signals = ids.length === 0 ? [] : await db.select().from(attemptSignals).where(inArray(attemptSignals.attemptId, ids));
  return rows.map(({ attempt, challenge, version, review }) => ({
    ...attempt,
    challenge,
    challengeVersion: version,
    reviewDecision: review,
    signals: signals.filter((signal) => signal.attemptId === attempt.id).map(({ signal, value, weight, createdAt }) => ({ signal, value, weight, createdAt })),
  }));
}

// companiesWithAccess lists the companies that saw the player's results (assessments they started)
// and those the player is a member of.
async function companiesWithAccess(db: Database, userId: string): Promise<Record<string, unknown>> {
  const [assessments, memberships] = await Promise.all([
    db
      .select({ company: companies.name, attemptId: attempts.id, startedAt: attempts.startedAt })
      .from(assessmentInvites)
      .innerJoin(attempts, eq(attempts.id, assessmentInvites.attemptId))
      .innerJoin(companies, eq(companies.id, assessmentInvites.companyId))
      .where(eq(attempts.userId, userId)),
    db
      .select({ company: companies.name, role: companyMembers.role, since: companyMembers.createdAt })
      .from(companyMembers)
      .innerJoin(companies, eq(companies.id, companyMembers.companyId))
      .where(eq(companyMembers.userId, userId)),
  ]);
  return { assessments, memberships };
}
