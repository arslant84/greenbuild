import "reflect-metadata";
import { ValidationError } from "@greenbuild/shared";
import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AppModule } from "./app.module.js";
import { rootModule } from "./root-module.js";

describe("rootModule", () => {
  it("runs without attempts when no service is configured", () => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    expect(rootModule({})).toBe(AppModule);
  });

  it("enables attempts when every service is configured", () => {
    const module = rootModule({
      DATABASE_URL: "postgres://api:pw@db/greenbuild",
      REDIS_URL: "redis://redis:6379",
      ATTACH_SECRET: "a".repeat(32),
      ENGINE_INTERNAL_URL: "http://engine:8080",
      ENGINE_INTERNAL_TOKEN: "i".repeat(32),
    });

    expect(module).toMatchObject({ module: AppModule });
  });

  it("fails on a partial setup instead of starting without attempts", () => {
    expect(() => rootModule({ DATABASE_URL: "postgres://api:pw@db/greenbuild" })).toThrow(ValidationError);
  });
});
