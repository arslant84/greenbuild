import { expect, test } from "@playwright/test";

// architecture.md, task 56: the app is installable. Browsers install it from its manifest, which needs a
// name, a standalone start page and PNG icons of 192 and 512 px; Safari uses the Apple touch icon.
test("the app links an installable manifest whose icons load", async ({ page }) => {
  await page.goto("/");
  const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestUrl).toBeTruthy();

  const manifest = (await (await page.request.get(manifestUrl ?? "")).json()) as { name: string; start_url: string; display: string; icons: { src: string; sizes: string }[] };
  expect([manifest.name, manifest.start_url, manifest.display]).toEqual(["greenbuild", "/play", "standalone"]);
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(["192x192", "512x512"]);
  for (const icon of manifest.icons) {
    const response = await page.request.get(icon.src);
    expect([response.status(), response.headers()["content-type"]]).toEqual([200, "image/png"]);
  }

  const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect((await page.request.get(appleIcon ?? "")).status()).toBe(200);
});
