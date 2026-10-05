import { MANIFEST_FIXTURE } from "../testing/manifest-fixture.js";
import { describe, expect, it } from "vitest";
import { launchPlan } from "./launch-plan.js";

describe("launchPlan", () => {
  it("sizes the nginx-502 sandbox from its manifest", () => {
    expect(launchPlan(MANIFEST_FIXTURE)).toEqual({
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
    expect(launchPlan({ ...MANIFEST_FIXTURE, resources: { cpu, memory: "1Gi" } })).toMatchObject({ cpuMillis: millis, memoryBytes: 1024 ** 3 });
  });

  it("defaults to no added capabilities", () => {
    expect(launchPlan({ ...MANIFEST_FIXTURE, capabilities: undefined }).capabilities).toEqual([]);
  });

  it.each([
    ["host network", { ...MANIFEST_FIXTURE, network: "host" }],
    ["a dangerous capability", { ...MANIFEST_FIXTURE, capabilities: ["SYS_ADMIN"] }],
    ["memory in bytes", { ...MANIFEST_FIXTURE, resources: { cpu: "500m", memory: "536870912" } }],
    ["no time limit", { ...MANIFEST_FIXTURE, time_limit_sec: undefined }],
  ])("refuses %s", (_name, spec) => {
    expect(() => launchPlan(spec)).toThrow();
  });
});
