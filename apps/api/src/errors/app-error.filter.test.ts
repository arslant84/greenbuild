import "reflect-metadata";
import { NotFoundError, ValidationError } from "@greenbuild/shared";
import { Controller, Get, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../app.module.js";

@Controller("test-errors")
class ThrowingController {
  @Get("not-found")
  notFound(): never {
    throw new NotFoundError("Challenge not found");
  }

  @Get("validation")
  validation(): never {
    throw new ValidationError("Invalid track", { field: "track" });
  }

  @Get("unexpected")
  unexpected(): never {
    throw new Error("connect ECONNREFUSED db-internal.greenbuild:5432");
  }
}

async function startTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ThrowingController],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.listen(0);
  return app;
}

describe("AppErrorFilter", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await startTestApp();
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  async function get(path: string): Promise<{ status: number; body: unknown }> {
    const response = await fetch(`${baseUrl}${path}`);
    return { status: response.status, body: await response.json() };
  }

  it("maps an AppError to its status and response", async () => {
    expect(await get("/test-errors/not-found")).toEqual({
      status: 404,
      body: { code: "not_found", message: "Challenge not found" },
    });
  });

  it("keeps error details", async () => {
    expect(await get("/test-errors/validation")).toEqual({
      status: 400,
      body: { code: "validation_failed", message: "Invalid track", details: { field: "track" } },
    });
  });

  it("hides unexpected errors behind a generic 500", async () => {
    expect(await get("/test-errors/unexpected")).toEqual({
      status: 500,
      body: { code: "internal", message: "Internal server error" },
    });
  });

  it("formats framework errors such as an unknown route", async () => {
    const { status, body } = await get("/no-such-route");

    expect(status).toBe(404);
    expect(body).toMatchObject({ code: "not_found" });
  });
});
