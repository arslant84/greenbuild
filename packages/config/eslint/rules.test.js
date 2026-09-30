import assert from "node:assert/strict";
import { test } from "node:test";
import { ESLint } from "eslint";
import config from "./index.js";

const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });

async function ruleIdsFor(source) {
  const [result] = await eslint.lintText(source, { filePath: "sample.ts" });
  return result.messages.map((message) => message.ruleId);
}

function repeatLines(line, count) {
  return Array.from({ length: count }, () => line).join("\n");
}

const violations = {
  "max-params": "export function sum(a: number, b: number, c: number, d: number) { return a + b + c + d; }",
  "max-depth": `export function deep(x: number) {
    if (x > 0) { if (x > 1) { if (x > 2) { if (x > 3) { return x; } } } }
    return 0;
  }`,
  complexity: `export function branchy(x: number) {\n${repeatLines("  if (x === 1) return 1;", 10)}\n  return 0;\n}`,
  "max-lines-per-function": `export function long() {\n${repeatLines("  console.log(1);", 41)}\n}`,
  "max-lines": repeatLines("console.log(1);", 301),
  "@typescript-eslint/no-explicit-any": "export const value: any = 1;",
  "@typescript-eslint/ban-ts-comment": "// @ts-ignore\nexport const value = 1;",
  "no-restricted-imports": 'import { api } from "apps/api";\nexport { api };',
};

for (const [ruleId, source] of Object.entries(violations)) {
  test(`reports ${ruleId}`, async () => {
    assert.ok((await ruleIdsFor(source)).includes(ruleId));
  });
}

test("reports imports from another module's internal files", async () => {
  const source = 'import { repo } from "../modules/users/internal/repo";\nexport { repo };';
  assert.ok((await ruleIdsFor(source)).includes("no-restricted-imports"));
});

test("accepts code within the limits", async () => {
  const source = "export function add(a: number, b: number): number { return a + b; }";
  assert.deepEqual(await ruleIdsFor(source), []);
});
