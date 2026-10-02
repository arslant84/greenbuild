import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { UnavailableError } from "@greenbuild/shared";
import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServicesEnv } from "../config/services-env.js";
import { EngineClient } from "./engine-client.js";

const TOKEN = "engine-internal-token-engine-32byte";
const REQUEST = { attemptId: "0199a5c4-7b2e-7c3a-9f10-2b3c4d5e6f70", sandboxId: "sbx-1", challengeId: "nginx-502-upstream" };

interface Received {
  url?: string;
  authorization?: string;
  body?: unknown;
}

let server: Server;
let received: Received;
let answer: { status: number; body: string };

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function client(): EngineClient {
  const { port } = server.address() as AddressInfo;
  return new EngineClient({ ENGINE_INTERNAL_URL: `http://127.0.0.1:${port}/`, ENGINE_INTERNAL_TOKEN: TOKEN } as ServicesEnv);
}

beforeEach(async () => {
  received = {};
  answer = { status: 200, body: JSON.stringify({ passed: true, output_tail: "the site is back\n", duration_ms: 812 }) };
  server = createServer((request, response) => {
    void readBody(request).then((body) => {
      received = { url: request.url ?? "", authorization: request.headers.authorization ?? "", body };
      response.writeHead(answer.status, { "content-type": "application/json" }).end(answer.body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("EngineClient.check", () => {
  it("asks the engine to check the sandbox with the internal token", async () => {
    await expect(client().check(REQUEST)).resolves.toEqual({ passed: true, output_tail: "the site is back\n", duration_ms: 812 });
    expect(received).toEqual({
      url: `/internal/attempts/${REQUEST.attemptId}/check`,
      authorization: `Bearer ${TOKEN}`,
      body: { sandbox_id: "sbx-1", challenge_id: "nginx-502-upstream" },
    });
  });

  it.each([
    ["an error status", { status: 500, body: "{}" }],
    ["an unexpected body", { status: 200, body: JSON.stringify({ passed: "yes" }) }],
    ["no JSON", { status: 200, body: "<html>" }],
  ])("turns %s into UnavailableError", async (_name, response) => {
    answer = response;

    await expect(client().check(REQUEST)).rejects.toBeInstanceOf(UnavailableError);
  });

  it("turns an unreachable engine into UnavailableError", async () => {
    const unreachable = client();
    await new Promise((resolve) => server.close(resolve));
    server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    await expect(unreachable.check(REQUEST)).rejects.toBeInstanceOf(UnavailableError);
  });
});
