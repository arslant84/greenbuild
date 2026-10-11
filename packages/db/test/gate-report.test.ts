import { describe, expect, it } from "vitest";
import { gateReport, parseSince } from "../src/gate-report.js";
import { attempts, challenges, challengeVersions } from "../src/schema/index.js";
import { uuidv7 } from "../src/uuid.js";
import { useMigratedDatabase, type MigratedDatabase } from "./migrated.js";

const SINCE = new Date("2026-10-01T00:00:00Z");
const CREATED = new Date("2026-10-05T12:00:00Z");
const BEFORE_SINCE = new Date("2026-09-20T12:00:00Z");
const SECOND_MS = 1000;
type FinalStatus = "solved" | "failed" | "expired" | "abandoned";

interface FixtureAttempt {
  status: FinalStatus;
  startSeconds: number | null;
  userId?: string;
  createdAt?: Date;
}

async function insertAttempts({ db }: MigratedDatabase, fixtures: FixtureAttempt[]): Promise<void> {
  const [challenge] = await db.insert(challenges).values({ slug: `c-${uuidv7()}`, title: "C", difficulty: 3 }).returning();
  const [version] = await db
    .insert(challengeVersions)
    .values({ challengeId: challenge?.id ?? "", version: 1, specJson: {}, imageRef: "img", checkerHash: "sha256:x", source: "human" })
    .returning();
  const rows = fixtures.map(({ status, startSeconds, userId = uuidv7(), createdAt = CREATED }) => ({
    userId,
    challengeVersionId: version?.id ?? "",
    seed: 1,
    context: "catalog" as const,
    status,
    createdAt,
    startedAt: startSeconds === null ? null : new Date(createdAt.getTime() + startSeconds * SECOND_MS),
  }));
  await db.insert(attempts).values(rows);
}

describe("gateReport", () => {
  const database = useMigratedDatabase();

  it("reports p95 start, failed start share and players with a solve since the date", async () => {
    const solver = uuidv7();
    const otherSolver = uuidv7();
    const readyStarts: FixtureAttempt[] = Array.from({ length: 20 }, (_, index) => ({ status: "expired", startSeconds: index + 1 }));
    readyStarts[0] = { status: "solved", startSeconds: 1, userId: solver };
    readyStarts[1] = { status: "solved", startSeconds: 2, userId: solver };
    readyStarts[2] = { status: "solved", startSeconds: 3, userId: otherSolver };
    await insertAttempts(database(), [
      ...readyStarts,
      { status: "failed", startSeconds: 1 },
      { status: "failed", startSeconds: null },
      { status: "abandoned", startSeconds: null },
      { status: "solved", startSeconds: 100, createdAt: BEFORE_SINCE },
    ]);

    const report = await gateReport(database().db, SINCE);

    // 21 ready starts (1, 1, 2 … 20 s): the 95th percentile is the 20th, 19 s.
    expect(report).toEqual({ since: SINCE, p95StartMs: 19_000, readyStarts: 21, failedStarts: 1, failedStartShare: 1 / 22, solvers: 2 });
  });
});

describe("parseSince", () => {
  it("reads the date as midnight UTC", () => {
    expect(parseSince(["--since", "2026-10-01"])).toEqual(SINCE);
  });

  it("rejects a missing or malformed date by naming the flag", () => {
    expect(() => parseSince([])).toThrow("report:gate --since: must be a date like 2026-10-01");
    expect(() => parseSince(["--since", "10/01/2026"])).toThrow("report:gate --since");
  });
});
