// A complete challenge manifest (nginx-502 version 1's values) for unit tests of manifest handling.
export const MANIFEST_FIXTURE = {
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
