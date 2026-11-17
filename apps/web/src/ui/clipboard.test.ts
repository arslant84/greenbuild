import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyText", () => {
  it("copies the text and answers true", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(copyText("https://greenbuild.dev/s/abc")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://greenbuild.dev/s/abc");
  });

  it("answers false when the browser refuses the clipboard", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new DOMException("Write permission denied.", "NotAllowedError")) } });
    await expect(copyText("x")).resolves.toBe(false);
  });

  it("answers false when the browser has no clipboard", async () => {
    vi.stubGlobal("navigator", {});
    await expect(copyText("x")).resolves.toBe(false);
  });
});
