import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";

export interface EngineAnswer {
  status: number;
  body: unknown;
}

export interface FakeEngineRequest {
  url: string;
  authorization: string;
  body: unknown;
}

export interface FakeEngine {
  url: string;
  // Answers to the next checks, in order; when empty, the check runs and does not pass.
  answers: EngineAnswer[];
  requests: FakeEngineRequest[];
  close: () => Promise<void>;
}

const NOT_PASSED: EngineAnswer = { status: 200, body: { passed: false, output_tail: "the site does not answer with 200\n", duration_ms: 90 } };

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
}

// startFakeEngine stands in for the engine's internal HTTP API on a free loopback port.
export async function startFakeEngine(): Promise<FakeEngine> {
  const engine: Omit<FakeEngine, "url" | "close"> = { answers: [], requests: [] };
  const server = createServer((request, response) => {
    void readJson(request).then((body) => {
      engine.requests.push({ url: request.url ?? "", authorization: request.headers.authorization ?? "", body });
      const answer = engine.answers.shift() ?? NOT_PASSED;
      response.writeHead(answer.status, { "content-type": "application/json" }).end(JSON.stringify(answer.body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    ...engine,
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
