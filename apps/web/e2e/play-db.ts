import { attempts, challenges, challengeVersions, connect, consents, desc, eq, users, userSettings, xpLedger } from "@greenbuild/db";

// The play stack's database (scripts/play-stack.sh). Tests write to it only what no screen can set yet:
// a handle and a hidden game profile (owner, 2026-10-14; the settings screen is task 47b), a player
// created before the 16+ rule (task 30b), an attempt whose sandbox never starts (task 56), and a daily
// attempt from yesterday for the history blocks.
const PLAY_DATABASE_URL = process.env.PLAY_DATABASE_URL ?? "postgres://postgres:play@127.0.0.1:15432/greenbuild";

async function withPlayDb<T>(run: (db: ReturnType<typeof connect>["db"]) => Promise<T>): Promise<T> {
  const connection = connect(PLAY_DATABASE_URL);
  try {
    return await run(connection.db);
  } finally {
    await connection.close();
  }
}

export async function setHandle(email: string, handle: string): Promise<void> {
  await withPlayDb(async (db) => {
    const updated = await db.update(users).set({ handle }).where(eq(users.email, email)).returning({ id: users.id });
    if (updated.length !== 1) {
      throw new Error(`no player signed in as ${email}`);
    }
  });
}

export async function hideGameProfile(email: string): Promise<void> {
  await withPlayDb(async (db) => {
    const [player] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (!player) {
      throw new Error(`no player signed in as ${email}`);
    }
    await db
      .insert(userSettings)
      .values({ userId: player.id, gameProfilePublic: false })
      .onConflictDoUpdate({ target: userSettings.userId, set: { gameProfilePublic: false } });
  });
}

// aPlayerCreatedBefore16Plus adds a player as accounts were before task 30b: no 16+ date, no consents.
export async function aPlayerCreatedBefore16Plus(email: string): Promise<void> {
  await withPlayDb(async (db) => {
    await db.insert(users).values({ email });
  });
}

// signUpRecord reads what sign-up recorded for a player: whether the 16+ date is set, and the consents.
export async function signUpRecord(email: string): Promise<{ ageConfirmed: boolean; consents: string[] }> {
  return withPlayDb(async (db) => {
    const [player] = await db.select({ id: users.id, ageConfirmed16At: users.ageConfirmed16At }).from(users).where(eq(users.email, email));
    if (!player) {
      throw new Error(`no player signed in as ${email}`);
    }
    const rows = await db.select({ kind: consents.kind }).from(consents).where(eq(consents.userId, player.id));
    return { ageConfirmed: player.ageConfirmed16At !== null, consents: rows.map((row) => row.kind).sort() };
  });
}

type AttemptFields = Omit<typeof attempts.$inferInsert, "userId" | "challengeVersionId" | "seed">;

// insertAttempt writes an attempt of the challenge for the player, as the API and the worker would leave it.
async function insertAttempt(email: string, slug: string, fields: AttemptFields): Promise<{ userId: string; attemptId: string }> {
  return withPlayDb(async (db) => {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    const [version] = await db
      .select({ id: challengeVersions.id })
      .from(challengeVersions)
      .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
      .where(eq(challenges.slug, slug))
      .orderBy(desc(challengeVersions.version))
      .limit(1);
    if (!user || !version) {
      throw new Error(`no player signed in as ${email} or no challenge ${slug}`);
    }
    const inserted = await db.insert(attempts).values({ ...fields, userId: user.id, challengeVersionId: version.id, seed: 1 }).returning({ id: attempts.id });
    const attemptId = inserted[0]?.id;
    if (!attemptId) {
      throw new Error(`no attempt created for ${email}`);
    }
    return { userId: user.id, attemptId };
  });
}

// startingAttempt gives the player an attempt of the challenge that stays "starting": no sandbox job is
// queued for it, so its start screen holds still however fast the stack is.
export async function startingAttempt(email: string, slug: string): Promise<string> {
  return (await insertAttempt(email, slug, { context: "catalog" })).attemptId;
}

const DAY_MS = 86_400_000;

// solvedYesterdaysDaily gives the player yesterday's daily, solved in 4m 15s with one hint, and its 150 XP.
export async function solvedYesterdaysDaily(email: string, slug: string): Promise<string> {
  const createdAt = new Date(Date.now() - DAY_MS);
  const { userId, attemptId } = await insertAttempt(email, slug, { context: "daily", status: "solved", createdAt, finishedAt: createdAt, durationMs: 255_000, hintsUsed: 1 });
  await withPlayDb((db) => db.insert(xpLedger).values({ userId, attemptId, amount: 150, reason: "solve", createdAt }));
  return attemptId;
}
