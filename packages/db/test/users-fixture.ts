import type { Database } from "../src/client.js";
import { users } from "../src/schema/index.js";

// aUser adds a user, since every attempt needs one (task 29b).
export async function aUser(db: Database): Promise<string> {
  const [user] = await db.insert(users).values({}).returning();
  return user?.id ?? "";
}
