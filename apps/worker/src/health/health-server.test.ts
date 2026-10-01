import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHealthServer } from "./health-server.js";

describe("health server", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createHealthServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns ok on GET /health", async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("rejects other methods on /health", async () => {
    const response = await fetch(`${baseUrl}/health`, { method: "POST" });

    expect(response.status).toBe(405);
    expect(await response.json()).toMatchObject({ code: "validation_failed" });
  });

  it("returns not_found for other paths", async () => {
    const response = await fetch(`${baseUrl}/jobs`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "not_found", message: "Not found" });
  });
});
