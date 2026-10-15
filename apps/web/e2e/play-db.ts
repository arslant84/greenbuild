import { connect, consents, eq, users, userSettings } from "@greenbuild/db";

// The play stack's database (scripts/play-stack.sh). Tests write to it only what no screen can set yet:
// a handle and a hidden game profile (owner, 2026-10-14; the settings screen is task 47b), and a player
// created before the 16+ rule (task 30b).
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
