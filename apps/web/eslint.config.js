import config from "@greenbuild/config/eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";

// Next.js's own rules (Core Web Vitals) and the React hooks rules on top of the project's limits.
// eslint-config-next's React, import and accessibility plugins do not support ESLint 10 yet
// (owner, 2026-10-11: add them when they do).
export default defineConfig(config, nextPlugin.configs["core-web-vitals"], reactHooks.configs.flat.recommended);
