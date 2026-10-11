import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const READY_TIMEOUT_MS = 30_000;
const RETRY_MS = 300;

export interface Container {
  // host:port on the loopback interface
  address: string;
  stop: () => Promise<void>;
}

interface ContainerOptions {
  image: string;
  port: number;
  env?: Record<string, string>;
  // Replaces the image's command, e.g. Azurite with --skipApiVersionCheck.
  args?: string[];
  ready: (address: string) => Promise<void>;
}

// startContainer runs image with port published on a free loopback port and waits until ready succeeds.
export async function startContainer(options: ContainerOptions): Promise<Container> {
  const env = Object.entries(options.env ?? {}).flatMap(([name, value]) => ["-e", `${name}=${value}`]);
  const { stdout } = await run("docker", ["run", "-d", "--rm", ...env, "-p", `127.0.0.1::${options.port}`, options.image, ...(options.args ?? [])]);
  const id = stdout.trim();
  const stop = async (): Promise<void> => {
    await run("docker", ["rm", "-f", id]);
  };
  try {
    const { stdout: published } = await run("docker", ["port", id, `${options.port}/tcp`]);
    const address = published.trim().split("\n")[0] ?? "";
    await retry(() => options.ready(address));
    return { address, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

async function retry(attempt: () => Promise<void>): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    try {
      await attempt();
      return;
    } catch (error) {
      if (Date.now() > deadline) {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
  }
}
