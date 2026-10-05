import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { manifestJsonSchemaText } from "../src/json-schema.js";

const committed = new URL("../challenge.schema.json", import.meta.url);

describe("challenge.schema.json", () => {
  it("matches the zod schema; run pnpm challenges:schema after changing it", async () => {
    expect(await readFile(committed, "utf8")).toBe(manifestJsonSchemaText());
  });
});
