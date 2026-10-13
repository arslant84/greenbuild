import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import { EXPORTS_BLOB_CONTAINER } from "@greenbuild/shared";
import { createTransport } from "nodemailer";
import type { ArchiveStore, Mailer } from "./export-job.js";

// BlobArchiveStore keeps export archives in EXPORTS_BLOB_CONTAINER, made on the first archive.
export class BlobArchiveStore implements ArchiveStore {
  private readonly container: ContainerClient;
  private ready: Promise<unknown> | undefined;

  constructor(connectionString: string) {
    this.container = BlobServiceClient.fromConnectionString(connectionString).getContainerClient(EXPORTS_BLOB_CONTAINER);
  }

  async put(name: string, json: string): Promise<void> {
    this.ready ??= this.container.createIfNotExists();
    await this.ready;
    await this.container.getBlockBlobClient(name).upload(json, Buffer.byteLength(json), { blobHTTPHeaders: { blobContentType: "application/json" } });
  }
}

// smtpMailer sends from one address over SMTP: Mailpit locally, the D6 provider elsewhere.
export function smtpMailer(server: string, from: string): Mailer {
  const transport = createTransport(server);
  return {
    async send(message) {
      await transport.sendMail({ ...message, from });
    },
  };
}
