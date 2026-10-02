import { describe, expect, it } from "vitest";
import { attachUrl, parseControl, resizeMessage } from "./protocol";

describe("attachUrl", () => {
  it("adds the token and the size to the engine URL", () => {
    const url = new URL(attachUrl("ws://127.0.0.1:8080/attach", "a.b+c/d", { rows: 30, cols: 100 }));

    expect(url.origin + url.pathname).toBe("ws://127.0.0.1:8080/attach");
    expect(url.searchParams.get("token")).toBe("a.b+c/d");
    expect(url.searchParams.get("rows")).toBe("30");
    expect(url.searchParams.get("cols")).toBe("100");
  });
});

describe("resizeMessage", () => {
  it("matches the engine's resize frame", () => {
    expect(JSON.parse(resizeMessage({ rows: 40, cols: 120 }))).toEqual({ type: "resize", rows: 40, cols: 120 });
  });
});

describe("parseControl", () => {
  it("reads the exit frame", () => {
    expect(parseControl('{"type":"exit","code":3}')).toEqual({ type: "exit", code: 3 });
  });

  it.each(["not json", '{"type":"exit"}', '{"type":"exit","code":"3"}', '{"type":"resize","rows":1,"cols":1}', "null"])(
    "ignores %s",
    (frame) => {
      expect(parseControl(frame)).toBeNull();
    },
  );
});
