import { BlobServiceClient } from "@azure/storage-blob";
import { EXPORTS_BLOB_CONTAINER } from "@greenbuild/shared";
import { type Container, startContainer } from "@greenbuild/testkit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BlobArchiveStore } from "./export-delivery.js";

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
      await BlobServiceClient.fromConnectionString(connection).listContainers().next();
    },
  });
}, 120_000);

afterAll(async () => {
  await azurite?.stop();
});

describe("BlobArchiveStore", () => {
  it("makes its container on the first archive and keeps each archive as JSON", async () => {
    const store = new BlobArchiveStore(connection);

    await store.put("request-1.json", '{"format":1}');
    await store.put("request-2.json", '{"format":1,"xp":[]}');
    const blob = BlobServiceClient.fromConnectionString(connection).getContainerClient(EXPORTS_BLOB_CONTAINER).getBlobClient("request-2.json");
    expect((await blob.downloadToBuffer()).toString("utf8")).toBe('{"format":1,"xp":[]}');
    expect((await blob.getProperties()).contentType).toBe("application/json");
  });
});
