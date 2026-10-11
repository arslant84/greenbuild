import { BlobServiceClient } from "@azure/storage-blob";
import { type Container, startContainer } from "@greenbuild/testkit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BlobSessionLogs, monthsBetween } from "./logs.js";

// Azurite's documented development account.
const ACCOUNT = "devstoreaccount1";
const KEY = "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";
let azurite: Container;
let connection: string;

beforeAll(async () => {
  azurite = await startContainer({
    image: "mcr.microsoft.com/azure-storage/azurite",
    port: 10000,
    args: ["azurite-blob", "--blobHost", "0.0.0.0", "--skipApiVersionCheck"],
    ready: async (address) => {
      connection = `DefaultEndpointsProtocol=http;AccountName=${ACCOUNT};AccountKey=${KEY};BlobEndpoint=http://${address}/${ACCOUNT};`;
      await BlobServiceClient.fromConnectionString(connection).getContainerClient("sessions").createIfNotExists();
    },
  });
}, 120_000);

afterAll(async () => {
  await azurite?.stop();
});

describe("monthsBetween", () => {
  it("lists every month an attempt touches", () => {
    expect(monthsBetween(new Date("2026-11-30T23:50:00Z"), new Date("2026-11-30T23:59:00Z"))).toEqual(["2026/11"]);
    expect(monthsBetween(new Date("2026-12-31T23:50:00Z"), new Date("2027-01-01T00:20:00Z"))).toEqual(["2026/12", "2027/01"]);
  });
});

// architecture.md, task 49b: the worker reads the logs the engine saves (yyyy/mm/{attempt}.jsonl).
describe("BlobSessionLogs", () => {
  it("joins the sessions of an attempt across months and answers null without a log", async () => {
    const sessions = BlobServiceClient.fromConnectionString(connection).getContainerClient("sessions");
    const lines = ['{"t":"2026-12-31T23:55:00Z","type":"start"}\n', '{"t":"2027-01-01T00:05:00Z","type":"command","data":"ls"}\n'];
    await sessions.getBlockBlobClient("2026/12/att-1.jsonl").upload(lines[0] ?? "", (lines[0] ?? "").length);
    await sessions.getBlockBlobClient("2027/01/att-1.jsonl").upload(lines[1] ?? "", (lines[1] ?? "").length);
    const logs = new BlobSessionLogs(connection);

    const events = await logs.read("att-1", new Date("2026-12-31T23:50:00Z"), new Date("2027-01-01T00:10:00Z"));
    expect(events?.map((event) => event.type)).toEqual(["start", "command"]);
    expect(await logs.read("att-none", new Date("2026-12-31T23:50:00Z"), new Date("2027-01-01T00:10:00Z"))).toBeNull();
  });
});
