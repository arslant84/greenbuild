import { createHash } from "node:crypto";
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { challenges, challengeVersions } from "../src/schema/index.js";
import { seedChallenges } from "../src/seed.js";
import { useMigratedDatabase } from "./migrated.js";

const CHALLENGES = fileURLToPath(new URL("../../../challenges/", import.meta.url));
const NGINX_502 = join(CHALLENGES, "nginx-502-upstream");
// nginx-502 version 1 is published: its checker must never change (a fix is a new version).
const NGINX_502_V1_CHECKER = "sha256:576ad185af44d968dd2b52e6cba69a1a427e78b07fd3010f4d12d3c82ee95061";

const roots: string[] = [];
afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

// challengesWith copies nginx-502 into a fresh challenges folder under another id.
async function challengesWith(id: string): Promise<{ root: string; dir: string }> {
  const root = await mkdtemp(join(tmpdir(), "seed-"));
  roots.push(root);
  const dir = join(root, id);
  await cp(NGINX_502, dir, { recursive: true });
  const manifest = await readFile(join(dir, "challenge.yaml"), "utf8");
  await writeFile(join(dir, "challenge.yaml"), manifest.replace(/^id: .*$/m, `id: ${id}`));
  return { root, dir };
}

// Seeding twice reads and writes every challenge twice: under 2 s alone, but CI runs it beside other
// packages' PostgreSQL containers, where it passed 5 s (PR #274), and the catalog grows to 60 (task 53).
const SEED_TWICE_TIMEOUT_MS = 30_000;

describe("seedChallenges on a migrated database", () => {
  const database = useMigratedDatabase();

  it("adds every challenge in challenges/ once, however often it runs", { timeout: SEED_TWICE_TIMEOUT_MS }, async () => {
    const { db } = database();
    await seedChallenges(db);
    await seedChallenges(db);

    const folders = (await readdir(CHALLENGES, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    const rows = await db.select().from(challenges);
    const versions = await db.select().from(challengeVersions);
    expect(rows.map((row) => row.slug).sort()).toEqual(folders.sort());
    expect(versions).toHaveLength(folders.length);
    const nginx = rows.find((row) => row.slug === "nginx-502-upstream");
    expect(nginx).toMatchObject({ status: "live", difficulty: 4 });
    const nginxVersion = versions.find((version) => version.challengeId === nginx?.id);
    expect(nginxVersion).toMatchObject({ version: 1, checkerHash: NGINX_502_V1_CHECKER, imageRef: "greenbuild-challenge/nginx-502-upstream:1", source: "human" });
    expect(nginxVersion?.specJson).toMatchObject({ id: "nginx-502-upstream", time_limit_sec: 900, capabilities: ["CHOWN", "SETUID", "SETGID"] });
  });

  it("refuses a published version whose checker changed", async () => {
    const { db } = database();
    const { root, dir } = await challengesWith("checker-changed");
    await seedChallenges(db, root);
    await writeFile(join(dir, "check.sh"), "#!/bin/sh\nexit 0\n");

    await expect(seedChallenges(db, root)).rejects.toThrow("checker-changed version 1 is published and its check.sh changed; create version 2");
  });

  it("refuses a published version whose manifest changed", async () => {
    const { db } = database();
    const { root, dir } = await challengesWith("manifest-changed");
    await seedChallenges(db, root);
    const manifest = await readFile(join(dir, "challenge.yaml"), "utf8");
    await writeFile(join(dir, "challenge.yaml"), manifest.replace("time_limit_sec: 900", "time_limit_sec: 600"));

    await expect(seedChallenges(db, root)).rejects.toThrow("manifest-changed version 1 is published and its challenge.yaml changed; create version 2");
  });

  it("refuses an invalid challenge folder before writing anything", async () => {
    const { db } = database();
    const { root, dir } = await challengesWith("broken");
    await rm(join(dir, "check.sh"));

    await expect(seedChallenges(db, root)).rejects.toThrow("broken: check.sh is missing");
    expect((await db.select().from(challenges)).map((row) => row.slug)).not.toContain("broken");
  });
});

describe("published nginx-502 version 1", () => {
  it("keeps its checker", async () => {
    const checker = await readFile(join(NGINX_502, "check.sh"));

    expect(`sha256:${createHash("sha256").update(checker).digest("hex")}`).toBe(NGINX_502_V1_CHECKER);
  });
});
