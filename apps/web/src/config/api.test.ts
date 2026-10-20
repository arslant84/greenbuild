import { describe, expect, it } from "vitest";
import { loadApiConfig } from "./api";

describe("loadApiConfig", () => {
  it("defaults to the local API and trims a trailing slash", () => {
    expect(loadApiConfig({}).apiUrl).toBe("http://127.0.0.1:3000");
    expect(loadApiConfig({ API_URL: "https://api.greenbuild.dev/" }).apiUrl).toBe("https://api.greenbuild.dev");
  });

  it("rejects an API URL that is not http or https", () => {
    expect(() => loadApiConfig({ API_URL: "ftp://api" })).toThrow();
  });
});
