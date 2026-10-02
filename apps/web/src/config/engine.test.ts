import { describe, expect, it } from "vitest";
import { loadEngineConfig } from "./engine";

describe("loadEngineConfig", () => {
  it("defaults to the local engine", () => {
    expect(loadEngineConfig({})).toEqual({ attachUrl: "ws://127.0.0.1:8080/attach" });
  });

  it("accepts wss", () => {
    expect(loadEngineConfig({ ENGINE_ATTACH_URL: "wss://engine.greenbuild.dev/attach" }).attachUrl).toBe(
      "wss://engine.greenbuild.dev/attach",
    );
  });

  it.each(["http://127.0.0.1:8080/attach", "not a url"])("rejects %s", (value) => {
    expect(() => loadEngineConfig({ ENGINE_ATTACH_URL: value })).toThrow();
  });
});
