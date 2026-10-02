import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { challenges, challengeVersions } from "../src/schema/index.js";
import { NGINX_502_CHECKER_HASH, NGINX_502_SPEC, seedChallenges } from "../src/seed.js";
import { useMigratedDatabase } from "./migrated.js";

const CHALLENGE_DIR = new URL("../../../challenges/nginx-502-upstream/", import.meta.url);

describe("seedChallenges on a migrated database", () => {
  const database = useMigratedDatabase();

  it("adds nginx-502 version 1 once, however often it runs", async () => {
    const { db } = database();
    await seedChallenges(db);
    await seedChallenges(db);

    const rows = await db.select().from(challenges);
    const versions = await db.select().from(challengeVersions);
    expect(rows.map((row) => [row.slug, row.status, row.difficulty])).toEqual([["nginx-502-upstream", "live", 4]]);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ challengeId: rows[0]?.id, version: 1, checkerHash: NGINX_502_CHECKER_HASH, source: "human" });
    expect(versions[0]?.specJson).toEqual(NGINX_502_SPEC);
  });
});

describe("the nginx-502 seed matches the challenge folder", () => {
  it("has the hash of the published check.sh", async () => {
    const checker = await readFile(new URL("check.sh", CHALLENGE_DIR));

    expect(`sha256:${createHash("sha256").update(checker).digest("hex")}`).toBe(NGINX_502_CHECKER_HASH);
  });

  it("has the manifest's id, version, difficulty and time limit", async () => {
    const manifest = await readFile(new URL("challenge.yaml", CHALLENGE_DIR), "utf8");

    expect(manifest).toMatch(new RegExp(`^id: ${NGINX_502_SPEC.id}$`, "m"));
    expect(manifest).toMatch(new RegExp(`^version: ${NGINX_502_SPEC.version}$`, "m"));
    expect(manifest).toMatch(new RegExp(`^difficulty: ${NGINX_502_SPEC.difficulty}\\b`, "m"));
    expect(manifest).toMatch(new RegExp(`^time_limit_sec: ${NGINX_502_SPEC.time_limit_sec}$`, "m"));
  });
});
