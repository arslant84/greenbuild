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
  hints: string[];
}

interface PublishedVersion {
  id: string;
  specJson: unknown;
  checkerHash: string;
  hintsJson: string[] | null;
}

// seedChallenges adds every challenge folder in challengesDir and each version it does not have yet;
// running it again changes nothing. A published version is never changed: if its manifest, checker
// or hints differ from the folder, the seed stops and asks for a new version. Versions published
// before hints were stored get theirs once.
export async function seedChallenges(db: Database, challengesDir = CHALLENGES_DIR): Promise<void> {
  const reports = await validateAll(challengesDir);
  const problems = reports.flatMap((report) => report.errors.map((error) => `${report.id}: ${error}`));
  if (problems.length > 0) {
    throw new Error(`seed: invalid challenges:\n${problems.join("\n")}`);
  }
  for (const report of reports) {
    if (report.manifest && report.hints) {
      await seedChallenge(db, { manifest: report.manifest, hints: report.hints, checkerHash: await checkerHash(join(challengesDir, report.id)) });
    }
  }
}

async function seedChallenge(db: Database, { manifest, checkerHash, hints }: SeedChallenge): Promise<void> {
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
      .select({ id: challengeVersions.id, specJson: challengeVersions.specJson, checkerHash: challengeVersions.checkerHash, hintsJson: challengeVersions.hintsJson })
      .from(challengeVersions)
      .where(and(eq(challengeVersions.challengeId, challenge.id), eq(challengeVersions.version, manifest.version)));
    if (published) {
      refuseChanges({ manifest, checkerHash, hints }, published);
      if (published.hintsJson === null) {
        await tx.update(challengeVersions).set({ hintsJson: hints }).where(eq(challengeVersions.id, published.id));
      }
      return;
    }
    await tx.insert(challengeVersions).values({
      challengeId: challenge.id,
      version: manifest.version,
      specJson: manifest,
      // The tag pnpm play:up builds; task 28g switches to registry digests.
      imageRef: `greenbuild-challenge/${manifest.id}:${manifest.version}`,
      checkerHash,
      hintsJson: hints,
      source: manifest.source,
    });
  });
}

function refuseChanges(folder: SeedChallenge, published: PublishedVersion): void {
  const { manifest } = folder;
  const changed = changedFile(folder, published);
  if (changed) {
    throw new Error(`seed: ${manifest.id} version ${manifest.version} is published and its ${changed} changed; create version ${manifest.version + 1}`);
  }
}

function changedFile(folder: SeedChallenge, published: PublishedVersion): string | null {
  if (published.checkerHash !== folder.checkerHash) {
    return "check.sh";
  }
  if (!isDeepStrictEqual(published.specJson, folder.manifest)) {
    return "challenge.yaml";
  }
  if (published.hintsJson !== null && !isDeepStrictEqual(published.hintsJson, folder.hints)) {
    return "hints.md";
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
