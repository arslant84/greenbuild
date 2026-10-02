import { describe, expect, it } from "vitest";
import { loadApiConfig } from "./api";

const SECRET = "d".repeat(32);

describe("loadApiConfig", () => {
  it("defaults to the local API and trims a trailing slash", () => {
    expect(loadApiConfig({}).apiUrl).toBe("http://127.0.0.1:3000");
    expect(loadApiConfig({ API_URL: "https://api.greenbuild.dev/" }).apiUrl).toBe("https://api.greenbuild.dev");
  });

  it("keeps the dev auth secret out of production", () => {
    expect(loadApiConfig({ DEV_AUTH_SECRET: SECRET }).devAuthSecret).toBe(SECRET);
    expect(loadApiConfig({ NODE_ENV: "production", DEV_AUTH_SECRET: SECRET }).devAuthSecret).toBeUndefined();
  });

  it.each([{ API_URL: "ftp://api" }, { DEV_AUTH_SECRET: "short" }])("rejects %o", (env) => {
    expect(() => loadApiConfig(env)).toThrow();
  });
});
