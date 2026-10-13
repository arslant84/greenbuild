import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import { EXPORTS_BLOB_CONTAINER, UnavailableError } from "@greenbuild/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { ServicesEnv } from "../config/services-env.js";
import { SERVICES_ENV } from "../infra/services.js";

// ExportArchives reads the archives the worker's data export job stored (task 50a). Without
// EXPORT_BLOB_CONNECTION_STRING there are none to read.
@Injectable()
export class ExportArchives {
  private readonly container: ContainerClient | null;

  constructor(@Inject(SERVICES_ENV) env: ServicesEnv) {
    const connection = env.EXPORT_BLOB_CONNECTION_STRING;
    this.container = connection ? BlobServiceClient.fromConnectionString(connection).getContainerClient(EXPORTS_BLOB_CONTAINER) : null;
  }

  async read(name: string): Promise<Buffer> {
    if (!this.container) {
      throw new UnavailableError("Data exports are not set up");
    }
    return this.container.getBlobClient(name).downloadToBuffer();
  }
}
