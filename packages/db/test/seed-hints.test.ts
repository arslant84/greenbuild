import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "../src/client.js";
import { challenges, challengeVersions } from "../src/schema/index.js";
import { seedChallenges } from "../src/seed.js";
import { useMigratedDatabase } from "./migrated.js";

// architecture.md, task 35a: hints.md is part of a published version, like its manifest and checker.
const NGINX_502 = fileURLToPath(new URL("../../../challenges/nginx-502-upstream/", import.meta.url));

const roots: string[] = [];
afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

// challengeFolder copies nginx-502 into a fresh challenges folder under another id.
async function challengeFolder(id: string): Promise<{ root: string; dir: string }> {
  const root = await mkdtemp(join(tmpdir(), "seed-hints-"));
  roots.push(root);
  const dir = join(root, id);
  await cp(NGINX_502, dir, { recursive: true });
  const manifest = await readFile(join(dir, "challenge.yaml"), "utf8");
  await writeFile(join(dir, "challenge.yaml"), manifest.replace(/^id: .*$/m, `id: ${id}`));
  return { root, dir };
}

async function storedHints(db: Database, slug: string): Promise<string[] | null | undefined> {
  const [row] = await db
    .select({ hints: challengeVersions.hintsJson })
    .from(challengeVersions)
    .innerJoin(challenges, eq(challenges.id, challengeVersions.challengeId))
    .where(eq(challenges.slug, slug));
  return row?.hints;
}

describe("seedChallenges and hints", () => {
  const database = useMigratedDatabase();

  it("stores hints.md's hints in the version, weakest first", async () => {
    const { db } = database();
    const { root } = await challengeFolder("hints-stored");
    await seedChallenges(db, root);

    const hints = await storedHints(db, "hints-stored");
    expect(hints).toHaveLength(3);
    expect(hints?.[0]).not.toContain("## Hint");
  });

  it("fills in the hints of a version published before hints were stored", async () => {
    const { db } = database();
    const { root } = await challengeFolder("hints-backfilled");
    await seedChallenges(db, root);
    await db.update(challengeVersions).set({ hintsJson: null });
    await seedChallenges(db, root);

    expect(await storedHints(db, "hints-backfilled")).toHaveLength(3);
  });

  it("refuses a published version whose hints changed", async () => {
    const { db } = database();
    const { root, dir } = await challengeFolder("hints-changed");
    await seedChallenges(db, root);
    const hints = await readFile(join(dir, "hints.md"), "utf8");
    await writeFile(join(dir, "hints.md"), hints.replace("## Hint 1\n", "## Hint 1\n\nA different first hint.\n"));

    await expect(seedChallenges(db, root)).rejects.toThrow("hints-changed version 1 is published and its hints.md changed; create version 2");
  });
});
