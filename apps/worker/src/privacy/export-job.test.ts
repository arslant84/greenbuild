import { randomUUID } from "node:crypto";
import { applyMigrations, connect, eq, privacyRequests, sql, users } from "@greenbuild/db";
import { EXPORT_LINK_DAYS } from "@greenbuild/shared";
import { type Container, startContainer } from "@greenbuild/testkit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ArchiveStore, type Mailer, processExportRequests } from "./export-job.js";

// architecture.md, "Права пользователя", task 50a: an export request becomes an archive and an email.
const NOW = new Date("2026-12-01T12:00:00Z");
const WEB_URL = "https://greenbuild.test";
const HOUR_MS = 3_600_000;
let container: Container;
let database: ReturnType<typeof connect>;

beforeAll(async () => {
  container = await startContainer({
    image: "postgres:16-alpine",
    port: 5432,
    env: { POSTGRES_PASSWORD: "test" },
    ready: async (address) => {
      const probe = connect(`postgres://postgres:test@${address}/postgres`);
      await probe.db.execute(sql`select 1`).finally(() => probe.close());
    },
  });
  const url = `postgres://postgres:test@${container.address}/postgres`;
  await applyMigrations(url);
  database = connect(url);
}, 120_000);

afterAll(async () => {
  await database?.close();
  await container?.stop();
});

// fakes records what the job stored and sent; failMail makes every email fail.
function fakes(failMail = false): { archives: ArchiveStore & { stored: Map<string, string> }; mail: Mailer & { sent: { to: string; text: string }[] } } {
  const stored = new Map<string, string>();
  const sent: { to: string; text: string }[] = [];
  return {
    archives: { stored, put: async (name, json) => void stored.set(name, json) },
    mail: {
      sent,
      send: async ({ to, text }) => {
        if (failMail) {
          throw new Error("smtp down");
        }
        sent.push({ to, text });
      },
    },
  };
}

async function anExportRequest(email: string | null, status: "pending" | "processing" = "pending", changedAt = NOW): Promise<string> {
  const [user] = await database.db.insert(users).values({ email }).returning();
  const [request] = await database.db
    .insert(privacyRequests)
    .values({ userId: user?.id ?? "", kind: "export", status, updatedAt: changedAt })
    .returning();
  return request?.id ?? "";
}

async function requestRow(id: string): Promise<{ status: string; artifactRef: string | null; completedAt: Date | null } | undefined> {
  const [row] = await database.db.select({ status: privacyRequests.status, artifactRef: privacyRequests.artifactRef, completedAt: privacyRequests.completedAt }).from(privacyRequests).where(eq(privacyRequests.id, id));
  return row;
}

describe("processExportRequests", () => {
  it("stores the archive, emails its owner the link and completes the request", async () => {
    const email = `${randomUUID()}@example.com`;
    const id = await anExportRequest(email);
    const { archives, mail } = fakes();

    await processExportRequests({ db: database.db, archives, mail, webUrl: WEB_URL }, NOW);
    expect(JSON.parse(archives.stored.get(`${id}.json`) ?? "{}")).toMatchObject({ format: 1, account: { email } });
    expect(mail.sent).toEqual([{ to: email, text: expect.stringContaining(`${WEB_URL}/api/me/export/${id}`) }]);
    expect(mail.sent[0]?.text).toContain(`${EXPORT_LINK_DAYS} days`);
    expect(await requestRow(id)).toEqual({ status: "completed", artifactRef: `${id}.json`, completedAt: NOW });
    expect(await processExportRequests({ db: database.db, archives, mail, webUrl: WEB_URL }, NOW)).toBe(0);
  });

  it("rejects the request of a player without an email, storing and sending nothing", async () => {
    const id = await anExportRequest(null);
    const { archives, mail } = fakes();

    await processExportRequests({ db: database.db, archives, mail, webUrl: WEB_URL }, NOW);
    expect((await requestRow(id))?.status).toBe("rejected");
    expect(archives.stored.has(`${id}.json`)).toBe(false);
    expect(mail.sent).toEqual([]);
  });

  it("puts a request back to pending when the email fails", async () => {
    const id = await anExportRequest(`${randomUUID()}@example.com`);
    const { archives, mail } = fakes(true);

    await expect(processExportRequests({ db: database.db, archives, mail, webUrl: WEB_URL }, NOW)).rejects.toThrow("smtp down");
    expect((await requestRow(id))?.status).toBe("pending");
    await processExportRequests({ db: database.db, ...fakes(), webUrl: WEB_URL }, NOW);
  });

  it("takes again a request a stopped worker left processing over an hour ago, not a recent one", async () => {
    const stale = await anExportRequest(`${randomUUID()}@example.com`, "processing", new Date(NOW.getTime() - 2 * HOUR_MS));
    const recent = await anExportRequest(`${randomUUID()}@example.com`, "processing", new Date(NOW.getTime() - HOUR_MS / 2));
    const { archives, mail } = fakes();

    await processExportRequests({ db: database.db, archives, mail, webUrl: WEB_URL }, NOW);
    expect((await requestRow(stale))?.status).toBe("completed");
    expect((await requestRow(recent))?.status).toBe("processing");
  });
});
