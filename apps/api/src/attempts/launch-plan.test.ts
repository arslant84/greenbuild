import { NGINX_502_SPEC } from "@greenbuild/db";
import { describe, expect, it } from "vitest";
import { launchPlan } from "./launch-plan.js";

describe("launchPlan", () => {
  it("sizes the nginx-502 sandbox from its manifest", () => {
    expect(launchPlan(NGINX_502_SPEC)).toEqual({
      cpuMillis: 500,
      memoryBytes: 512 * 1024 ** 2,
      ttlSeconds: 900,
      network: "none",
      capabilities: ["CHOWN", "SETUID", "SETGID"],
    });
  });

  it.each([
    ["1", 1000],
    ["0.25", 250],
    ["1500m", 1500],
  ])("reads cpu %s as %d millicores", (cpu, millis) => {
    expect(launchPlan({ ...NGINX_502_SPEC, resources: { cpu, memory: "1Gi" } })).toMatchObject({ cpuMillis: millis, memoryBytes: 1024 ** 3 });
  });

  it("defaults to no added capabilities", () => {
    expect(launchPlan({ ...NGINX_502_SPEC, capabilities: undefined }).capabilities).toEqual([]);
  });

  it.each([
    ["host network", { ...NGINX_502_SPEC, network: "host" }],
    ["a dangerous capability", { ...NGINX_502_SPEC, capabilities: ["SYS_ADMIN"] }],
    ["memory in bytes", { ...NGINX_502_SPEC, resources: { cpu: "500m", memory: "536870912" } }],
    ["no time limit", { ...NGINX_502_SPEC, time_limit_sec: undefined }],
  ])("refuses %s", (_name, spec) => {
    expect(() => launchPlan(spec)).toThrow();
  });
});
