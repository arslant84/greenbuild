import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { connect, type Database } from "./client.js";
import { loadDatabaseUrl } from "./config.js";
import { challenges, challengeVersions } from "./schema/index.js";

// From challenges/nginx-502-upstream/challenge.yaml until packages/challenge-spec parses manifests.
export const NGINX_502_SPEC = {
  id: "nginx-502-upstream",
  version: 1,
  title: "The site returns 502",
  statement: "Users see 502 Bad Gateway. Bring the site back.",
  difficulty: 4,
  skills: { linux: 0.4, nginx: 0.6 },
  time_limit_sec: 900,
  resources: { cpu: "500m", memory: "512Mi", disk: "1Gi" },
  network: "none",
  capabilities: ["CHOWN", "SETUID", "SETGID"],
  randomize: { app_port: { range: [3000, 3999] }, app_user: { pick: ["svc", "webapp", "runner"] } },
  check: { command: "/opt/greenbuild/check.sh", timeout_sec: 20, run_as: "root" },
  hints: 3,
  source: "human",
} as const;

// SHA-256 of check.sh as published in version 1; a test fails if the file changes without a new version.
export const NGINX_502_CHECKER_HASH = "sha256:576ad185af44d968dd2b52e6cba69a1a427e78b07fd3010f4d12d3c82ee95061";
// The image cmd/dev-attempt starts locally; the challenge pipeline will write registry digests.
export const NGINX_502_DEV_IMAGE = "greenbuild-challenge/nginx-502-upstream:dev";

// seedChallenges adds nginx-502 and its version 1; running it again changes nothing.
export async function seedChallenges(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(challenges)
      .values({ slug: NGINX_502_SPEC.id, title: NGINX_502_SPEC.title, difficulty: NGINX_502_SPEC.difficulty, status: "live" })
      .onConflictDoNothing({ target: challenges.slug });
    const [challenge] = await tx.select({ id: challenges.id }).from(challenges).where(eq(challenges.slug, NGINX_502_SPEC.id));
    if (!challenge) {
      throw new Error(`seed: challenge ${NGINX_502_SPEC.id} is missing after insert`);
    }
    const existing = await tx
      .select({ id: challengeVersions.id })
      .from(challengeVersions)
      .where(and(eq(challengeVersions.challengeId, challenge.id), eq(challengeVersions.version, NGINX_502_SPEC.version)));
    if (existing.length > 0) {
      return;
    }
    await tx.insert(challengeVersions).values({
      challengeId: challenge.id,
      version: NGINX_502_SPEC.version,
      specJson: NGINX_502_SPEC,
      imageRef: NGINX_502_DEV_IMAGE,
      checkerHash: NGINX_502_CHECKER_HASH,
      source: NGINX_502_SPEC.source,
    });
  });
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
