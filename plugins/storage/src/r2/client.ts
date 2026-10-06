import { AwsClient } from "aws4fetch";

export interface R2ClientConfig {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  region?: string;
  publicUrl?: string;
}

export interface StoredObjectHead {
  size: number;
  contentType?: string;
  lastModified?: Date;
}

export class R2Client {
  private client: AwsClient;
  private bucket: string;
  private endpoint: string;
  private publicUrl: string;

  constructor(config: R2ClientConfig) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: "s3",
      region: config.region || "auto",
    });
    this.bucket = config.bucket;
    this.endpoint = config.endpoint;
    this.publicUrl = config.publicUrl || `${config.endpoint}/${config.bucket}`;
  }

  async generatePresignedPutUrl(
    key: string,
    contentType: string,
    expiresIn = 3600,
  ): Promise<string> {
    const url = `${this.endpoint}/${this.bucket}/${key}`;
    const signed = await this.client.sign(url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      aws: { signQuery: true, allHeaders: true, expires: expiresIn },
    } as Parameters<AwsClient["sign"]>[1]);
    return signed.url;
  }

  async generatePresignedGetUrl(key: string, expiresIn = 3600): Promise<string> {
    const url = `${this.endpoint}/${this.bucket}/${key}`;
    const signed = await this.client.sign(url, {
      method: "GET",
      aws: { signQuery: true, expires: expiresIn },
    } as Parameters<AwsClient["sign"]>[1]);
    return signed.url;
  }

  async deleteObject(key: string): Promise<void> {
    const url = `${this.endpoint}/${this.bucket}/${key}`;
    const response = await this.client.fetch(url, { method: "DELETE" });
    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to delete object: ${response.status} ${await response.text()}`);
    }
  }

  async headObject(key: string): Promise<StoredObjectHead | null> {
    const url = `${this.endpoint}/${this.bucket}/${key}`;
    let response: Response;
    try {
      response = await this.client.fetch(url, { method: "HEAD" });
    } catch (error) {
      throw new Error(
        `Failed to check object: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Failed to check object: status ${response.status}`);
    }
    const lastModifiedHeader = response.headers.get("last-modified");
    return {
      size: Number.parseInt(response.headers.get("content-length") ?? "0", 10),
      contentType: response.headers.get("content-type") ?? undefined,
      lastModified: lastModifiedHeader ? new Date(lastModifiedHeader) : undefined,
    };
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }
}
