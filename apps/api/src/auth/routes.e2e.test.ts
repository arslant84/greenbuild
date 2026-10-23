import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants.js";
import { DiscoveryService, MetadataScanner, ModulesContainer } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { type AttemptsApp, useAttemptsApp } from "../testing/attempts-app.js";

// architecture.md, task 30c: every route needs a session unless it is public, and the public ones are
// exactly those the architecture's API rules name.
const ARCHITECTURE = new URL("../../../../docs/architecture.md", import.meta.url);
const PUBLIC_ROUTES = ["GET /health", "GET /v1/share/:token", "GET /v1/users/:handle", "POST /v1/notifications/unsubscribe"];

interface Route {
  method: string;
  path: string;
}

const joinPath = (...parts: string[]) => `/${parts.map((part) => part.replace(/^\/|\/$/g, "")).filter(Boolean).join("/")}`;

// routes lists every controller method the running API serves, from Nest's own route metadata.
function routes(app: () => AttemptsApp): Route[] {
  const nest = app().nest;
  const discovery = new DiscoveryService(nest.get(ModulesContainer));
  const scanner = new MetadataScanner();
  return discovery.getControllers().flatMap(({ instance, metatype }) => {
    const base = String(Reflect.getMetadata(PATH_METADATA, metatype as object) ?? "");
    const prototype = Object.getPrototypeOf(instance) as object;
    return scanner.getAllMethodNames(prototype).flatMap((name) => {
      const handler = (prototype as Record<string, unknown>)[name] as object;
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      return path === undefined || method === undefined ? [] : [{ method: RequestMethod[method], path: joinPath(base, path) }];
    });
  });
}

// The rules line in architecture.md that names the public routes.
async function documentedRules(): Promise<string> {
  const text = await readFile(ARCHITECTURE, "utf8");
  return text.split("\n").find((line) => line.includes("Каждый эндпоинт явно объявляет доступ")) ?? "";
}

describe("explicit access on every API route", () => {
  const app = useAttemptsApp();

  it("answers 401 without a token on every route except the public ones", async () => {
    const found = routes(app);
    expect(found.length).toBeGreaterThan(PUBLIC_ROUTES.length);
    const open: string[] = [];
    for (const route of found) {
      const url = `${app().baseUrl}${route.path.replace(/:[a-zA-Z]+/g, randomUUID())}`;
      const response = await fetch(url, { method: route.method, headers: { "content-type": "application/json" }, body: route.method === "GET" ? null : "{}" });
      if (response.status !== 401) {
        open.push(`${route.method} ${route.path}`);
      }
    }
    expect(open.sort()).toEqual(PUBLIC_ROUTES);
  });

  it("names every public route in the architecture's API rules", async () => {
    const rules = await documentedRules();
    for (const route of PUBLIC_ROUTES) {
      // Nest writes parameters as :name, the architecture as {name}.
      const path = (route.split(" ")[1] ?? "").replace(/:([a-zA-Z]+)/g, "{$1}");
      expect(rules).toContain(`\`${path}\``);
    }
  });
});
