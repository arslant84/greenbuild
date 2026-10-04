import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { sandboxCreateSchema, sandboxDestroySchema, sandboxStatusSchema } from "./index.js";

const SCHEMAS = new URL("../../../queue/schemas/", import.meta.url);
// Keywords that constrain values; descriptions and $id are documentation.
const COMPARED_KEYWORDS = ["type", "const", "enum", "minimum", "maximum", "minLength", "maxLength"] as const;

interface JsonSchema {
  required?: string[];
  additionalProperties?: boolean;
  properties: Record<string, Record<string, unknown>>;
}

async function sourceOfTruth(file: string): Promise<JsonSchema> {
  return JSON.parse(await readFile(new URL(file, SCHEMAS), "utf8")) as JsonSchema;
}

// expectSameContract compares what each field accepts, keyword by keyword, including array items.
function expectSameContract(source: JsonSchema, schema: z.ZodType): void {
  const generated = z.toJSONSchema(schema, { unrepresentable: "any" }) as JsonSchema;
  expect(Object.keys(generated.properties).sort()).toEqual(Object.keys(source.properties).sort());
  expect([...(generated.required ?? [])].sort()).toEqual([...(source.required ?? [])].sort());
  expect(generated.additionalProperties).toBe(source.additionalProperties);
  for (const [name, field] of Object.entries(source.properties)) {
    const twin = generated.properties[name] ?? {};
    for (const keyword of COMPARED_KEYWORDS) {
      if (keyword in field && !(keyword === "type" && "const" in field)) {
        expect({ [name]: twin[keyword] }).toEqual({ [name]: field[keyword] });
      }
    }
    if (field.items) {
      expect({ [name]: (twin.items as Record<string, unknown>).enum }).toEqual({ [name]: (field.items as Record<string, unknown>).enum });
    }
  }
}

describe("queue contracts match packages/queue/schemas", () => {
  it("sandbox.create", async () => {
    expectSameContract(await sourceOfTruth("sandbox.create.v1.json"), sandboxCreateSchema);
  });

  it("sandbox.status", async () => {
    expectSameContract(await sourceOfTruth("sandbox.status.v1.json"), sandboxStatusSchema);
  });

  it("sandbox.destroy", async () => {
    expectSameContract(await sourceOfTruth("sandbox.destroy.v1.json"), sandboxDestroySchema);
  });
});

describe("rules the JSON Schemas state with if/then or uniqueItems", () => {
  it("a ready status needs a sandbox id", () => {
    expect(sandboxStatusSchema.safeParse({ version: 1, attempt_id: "a", status: "ready" }).success).toBe(false);
    expect(sandboxStatusSchema.safeParse({ version: 1, attempt_id: "a", status: "ready", sandbox_id: "s" }).success).toBe(true);
    expect(sandboxStatusSchema.safeParse({ version: 1, attempt_id: "a", status: "failed" }).success).toBe(true);
  });

  it("capabilities do not repeat", () => {
    const base = { version: 1, attempt_id: "a", image: "i", seed: 1, cpu_millis: 500, memory_bytes: 1 << 29, ttl_seconds: 900, network: "none" };
    expect(sandboxCreateSchema.safeParse({ ...base, capabilities: ["CHOWN", "CHOWN"] }).success).toBe(false);
    expect(sandboxCreateSchema.safeParse({ ...base, capabilities: ["CHOWN", "SETUID"] }).success).toBe(true);
  });
});
