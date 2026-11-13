import { connect, eq, users } from "@greenbuild/db";
import { isoWeek, leaderboardKeys } from "@greenbuild/shared";
import { createClient } from "redis";

// The play stack's leaderboards (scripts/play-stack.sh). The worker writes them after a solve, which takes
// a whole attempt, so tests put a player on a board directly and take them off again.
const PLAY_REDIS_URL = process.env.PLAY_REDIS_URL ?? "redis://127.0.0.1:16379";
const PLAY_DATABASE_URL = process.env.PLAY_DATABASE_URL ?? "postgres://postgres:play@127.0.0.1:15432/greenbuild";

async function userIdOf(email: string): Promise<string> {
  const connection = connect(PLAY_DATABASE_URL);
  try {
    const [user] = await connection.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (!user) {
      throw new Error(`no player signed in as ${email}`);
    }
    return user.id;
  } finally {
    await connection.close();
  }
}

// onWeeklyBoard puts the player first on this week's global board, runs the test, then takes them off, so
// the local board (shared with any other stack on this machine) is left as it was.
export async function onWeeklyBoard(email: string, run: () => Promise<void>): Promise<void> {
  const userId = await userIdOf(email);
  const key = leaderboardKeys.globalWeekly(isoWeek(new Date()));
  const boards = createClient({ url: PLAY_REDIS_URL });
  await boards.connect();
  try {
    const [top] = await boards.zRangeWithScores(key, 0, 0, { REV: true });
    await boards.zAdd(key, { score: (top?.score ?? 0) + 1, value: userId });
    await run();
  } finally {
    await boards.zRem(key, userId);
    await boards.quit();
  }
}
