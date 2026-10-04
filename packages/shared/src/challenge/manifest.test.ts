import { describe, expect, it } from "vitest";
import { challengeManifestSchema } from "./manifest.js";

const manifest = {
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
};

function errorsOf(input: unknown): string[] {
  const result = challengeManifestSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

describe("challengeManifestSchema", () => {
  it("accepts a complete manifest", () => {
    expect(errorsOf(manifest)).toEqual([]);
  });

  it("defaults capabilities and randomize when a challenge needs neither", () => {
    const plain = Object.fromEntries(Object.entries(manifest).filter(([key]) => key !== "capabilities" && key !== "randomize"));
    expect(challengeManifestSchema.parse(plain)).toMatchObject({ capabilities: [], randomize: {} });
  });

  it.each([
    { name: "an unknown key", change: { hint: 3 }, path: "" },
    { name: "an id that is not a slug", change: { id: "Nginx_502" }, path: "id" },
    { name: "difficulty above 10", change: { difficulty: 11 }, path: "difficulty" },
    { name: "skill weights that do not add up to 1", change: { skills: { linux: 0.4, nginx: 0.4 } }, path: "skills" },
    { name: "no skills", change: { skills: {} }, path: "skills" },
    { name: "a capability the agent refuses", change: { capabilities: ["SYS_ADMIN"] }, path: "capabilities.0" },
    { name: "a repeated capability", change: { capabilities: ["CHOWN", "CHOWN"] }, path: "capabilities" },
    { name: "a network other than none", change: { network: "allowlist" }, path: "network" },
    { name: "a range with min above max", change: { randomize: { port: { range: [4000, 3000] } } }, path: "randomize.port" },
    { name: "a pick with one value", change: { randomize: { user: { pick: ["svc"] } } }, path: "randomize.user.pick" },
    { name: "a checker outside /opt/greenbuild", change: { check: { command: "/tmp/check.sh", timeout_sec: 20, run_as: "root" } }, path: "check.command" },
    { name: "more than 3 hints", change: { hints: 4 }, path: "hints" },
    { name: "an unknown source", change: { source: "vendor" }, path: "source" },
  ])("rejects $name", ({ change, path }) => {
    const errors = errorsOf({ ...manifest, ...change });
    expect(errors.some((error) => error.startsWith(`${path}:`))).toBe(true);
  });
});
