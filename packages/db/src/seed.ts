import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { validateAll } from "@greenbuild/challenge-spec";
import type { ChallengeManifest } from "@greenbuild/shared";
import { and, eq } from "drizzle-orm";
import { connect, type Database } from "./client.js";
import { loadDatabaseUrl } from "./config.js";
import { challenges, challengeVersions } from "./schema/index.js";

const CHALLENGES_DIR = fileURLToPath(new URL("../../../challenges", import.meta.url));

interface SeedChallenge {
  manifest: ChallengeManifest;
  checkerHash: string;
}

// seedChallenges adds every challenge folder in challengesDir and each version it does not have yet;
// running it again changes nothing. A published version is never changed: if its manifest or
// checker differs from the folder, the seed stops and asks for a new version.
export async function seedChallenges(db: Database, challengesDir = CHALLENGES_DIR): Promise<void> {
  const reports = await validateAll(challengesDir);
  const problems = reports.flatMap((report) => report.errors.map((error) => `${report.id}: ${error}`));
  if (problems.length > 0) {
    throw new Error(`seed: invalid challenges:\n${problems.join("\n")}`);
  }
  for (const report of reports) {
    if (report.manifest) {
      await seedChallenge(db, { manifest: report.manifest, checkerHash: await checkerHash(join(challengesDir, report.id)) });
    }
  }
}

async function seedChallenge(db: Database, { manifest, checkerHash }: SeedChallenge): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(challenges)
      .values({ slug: manifest.id, title: manifest.title, difficulty: manifest.difficulty, status: "live" })
      .onConflictDoNothing({ target: challenges.slug });
    const [challenge] = await tx.select({ id: challenges.id }).from(challenges).where(eq(challenges.slug, manifest.id));
    if (!challenge) {
      throw new Error(`seed: challenge ${manifest.id} is missing after insert`);
    }
    const [published] = await tx
      .select({ specJson: challengeVersions.specJson, checkerHash: challengeVersions.checkerHash })
      .from(challengeVersions)
      .where(and(eq(challengeVersions.challengeId, challenge.id), eq(challengeVersions.version, manifest.version)));
    if (published) {
      refuseChanges(manifest, checkerHash, published);
      return;
    }
    await tx.insert(challengeVersions).values({
      challengeId: challenge.id,
      version: manifest.version,
      specJson: manifest,
      imageRef: `greenbuild-challenge/${manifest.id}:dev`,
      checkerHash,
      source: manifest.source,
    });
  });
}

function refuseChanges(manifest: ChallengeManifest, checkerHash: string, published: { specJson: unknown; checkerHash: string }): void {
  const changed = changedFile(manifest, checkerHash, published);
  if (changed) {
    throw new Error(`seed: ${manifest.id} version ${manifest.version} is published and its ${changed} changed; create version ${manifest.version + 1}`);
  }
}

function changedFile(manifest: ChallengeManifest, checkerHash: string, published: { specJson: unknown; checkerHash: string }): string | null {
  if (published.checkerHash !== checkerHash) {
    return "check.sh";
  }
  if (!isDeepStrictEqual(published.specJson, manifest)) {
    return "challenge.yaml";
  }
  return null;
}

async function checkerHash(dir: string): Promise<string> {
  return `sha256:${createHash("sha256").update(await readFile(join(dir, "check.sh"))).digest("hex")}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const connection = connect(loadDatabaseUrl());
  try {
    await seedChallenges(connection.db);
    console.log("seed applied");
  } finally {
    await connection.close();
  }
}
