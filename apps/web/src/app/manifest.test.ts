import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("manifest", () => {
  it("makes the app installable: a name, a standalone start page and PNG icons of 192 and 512 px", () => {
    const app = manifest();
    expect(app).toMatchObject({ name: "greenbuild", start_url: "/play", display: "standalone" });
    expect(app.icons?.map((icon) => [icon.src, icon.sizes, icon.type])).toEqual([
      ["/app-icon/192", "192x192", "image/png"],
      ["/app-icon/512", "512x512", "image/png"],
    ]);
  });
});
