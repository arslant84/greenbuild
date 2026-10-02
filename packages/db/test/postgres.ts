import { execFile } from "node:child_process";
import { promisify } from "node:util";
import postgres from "postgres";

const run = promisify(execFile);
const IMAGE = "postgres:16-alpine";
const READY_TIMEOUT_MS = 30_000;
const RETRY_MS = 300;

export interface TestDatabase {
  url: string;
  stop: () => Promise<void>;
}

// startPostgres runs an empty PostgreSQL 16 on a free loopback port with a throwaway password.
export async function startPostgres(): Promise<TestDatabase> {
  const { stdout } = await run("docker", ["run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=test", "-p", "127.0.0.1::5432", IMAGE]);
  const id = stdout.trim();
  const stop = async (): Promise<void> => {
    await run("docker", ["rm", "-f", id]);
  };
  try {
    const { stdout: port } = await run("docker", ["port", id, "5432/tcp"]);
    const url = `postgres://postgres:test@${port.trim().split("\n")[0] ?? ""}/postgres`;
    await waitUntilReady(url);
    return { url, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

// The image's init runs a temporary server on a Unix socket only, so a TCP answer means it is ready.
async function waitUntilReady(url: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    const sql = postgres(url, { max: 1, onnotice: () => undefined });
    try {
      await sql`select 1`;
      return;
    } catch (error) {
      if (Date.now() > deadline) {
        throw error;
      }
    } finally {
      await sql.end();
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
  }
}
