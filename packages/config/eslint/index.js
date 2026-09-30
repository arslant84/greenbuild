import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

// Size and safety limits from CLAUDE.md. Changing them requires explicit approval.
const projectRules = {
  "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true }],
  "max-params": ["error", 3],
  "max-depth": ["error", 3],
  complexity: ["error", 10],
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/ban-ts-comment": "error",
  "no-restricted-imports": ["error", { patterns: ["apps/*", "**/modules/*/internal/*"] }],
};

export default defineConfig(
  { ignores: ["**/dist/**", "**/.next/**", "**/coverage/**", "**/.turbo/**"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: projectRules,
  },
);
