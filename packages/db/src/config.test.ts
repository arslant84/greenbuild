import { describe, expect, it } from "vitest";
import { loadDatabaseUrl } from "./config.js";

describe("loadDatabaseUrl", () => {
  it.each(["postgres://app:pw@db:5432/greenbuild", "postgresql://app:pw@db/greenbuild?sslmode=require"])("accepts %s", (url) => {
    expect(loadDatabaseUrl({ DATABASE_URL: url })).toBe(url);
  });

  it.each([undefined, "", "mysql://app:s3cret@db/greenbuild", "not a url"])("rejects %s without echoing it", (url) => {
    expect(() => loadDatabaseUrl({ DATABASE_URL: url })).toThrow(/^DATABASE_URL must be a postgres/);
  });
});
