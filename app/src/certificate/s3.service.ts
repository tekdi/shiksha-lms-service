import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'node:stream';
import { ConfigService } from '@nestjs/config';

/**
 * Service for handling S3 file operations
 * Manages file uploads and downloads with AWS S3
 */
@Injectable()
export class S3Service {
  /** S3 client instance for AWS operations */
  private readonly s3: S3Client;

  /** S3 bucket name for file storage */
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    // Initialize S3 client with configuration from environment variables
    this.s3 = new S3Client({
      region:
        this.configService.get<string>('AWS_REGION') ||
        this.configService.get<string>('CLOUD_STORAGE_REGION') ||
        'us-east-1',
      credentials: {
        accessKeyId:
          this.configService.get<string>('AWS_ACCESS_KEY_ID') ||
          this.configService.get<string>('CLOUD_STORAGE_ACCOUNTNAME') ||
          '',
        secretAccessKey:
          this.configService.get<string>('AWS_SECRET_ACCESS_KEY') ||
          this.configService.get<string>('CLOUD_STORAGE_SECRET') ||
          '',
      },
    });

    // Get bucket name from configuration
    this.bucket =
      this.configService.get<string>('AWS_BUCKET') ||
      this.configService.get<string>('CLOUD_STORAGE_BUCKETNAME') ||
      '';
  }

  /**
   * Upload a file to S3
   *
   * Takes a file buffer and uploads it to S3 with the specified key.
   * Returns the public URL of the uploaded file.
   *
   * @param buffer - File buffer to upload
   * @param key - S3 key (path) for the file
   * @param mimetype - MIME type of the file
   * @returns Promise<string> - Public URL of the uploaded file
   */
  async uploadFile(
    buffer: Buffer,
    key: string,
    mimetype: string,
  ): Promise<string> {
    // Upload file to S3 using PutObjectCommand
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      }),
    );

    // Return the public URL for the uploaded file
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  /**
   * Upload a readable stream to S3 using multipart upload.
   *
   * Unlike uploadFile() which requires the entire file in memory as a Buffer,
   * this method accepts a Node.js Readable stream and pipes it directly to S3
   * in chunks. This keeps memory flat regardless of file size — the caller
   * never needs to hold the full file content in RAM simultaneously.
   *
   * Used by export handlers to stream ExcelJS workbooks directly to S3
   * without going through writeBuffer() first.
   */
  async uploadStream(
    stream: Readable,
    key: string,
    mimetype: string,
  ): Promise<string> {
    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: stream,
        ContentType: mimetype,
      },
    });

    await upload.done();
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  /**
   * Download a file from S3
   *
   * Downloads a file from S3 using the specified key and converts
   * the response stream to a Buffer for processing.
   *
   * @param key - S3 key (path) of the file to download
   * @returns Promise<Buffer> - File contents as a buffer
   */
  async downloadFile(key: string): Promise<Buffer> {
    // Create GetObjectCommand for downloading
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    // Send command and get response
    const response = await this.s3.send(command);

    // Convert response stream to Buffer
    // response.Body is a stream, so we need to convert it to a Buffer
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  /**
   * Delete a file from S3
   *
   * Deletes a file from S3 using the specified key.
   *
   * @param key - S3 key (path) of the file to delete
   * @returns Promise<void>
   */
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3.send(command);
  }

  /**
   * Extract S3 key from a full S3 URL
   *
   * Extracts the S3 key from a full S3 URL (e.g., https://bucket.s3.amazonaws.com/key)
   *
   * @param url - Full S3 URL
   * @returns string | null - S3 key or null if URL is invalid
   */
  extractKeyFromUrl(url: string): string | null {
    if (!url) {
      return null;
    }

    // Handle different S3 URL formats:
    // https://bucket.s3.amazonaws.com/key
    // https://bucket.s3.region.amazonaws.com/key
    // https://s3.amazonaws.com/bucket/key
    // https://s3.region.amazonaws.com/bucket/key

    try {
      const urlObj = new URL(url);

      // Format: https://bucket.s3.amazonaws.com/key or https://bucket.s3.region.amazonaws.com/key
      if (
        urlObj.hostname.includes('.s3.') ||
        urlObj.hostname.includes('.s3.amazonaws.com')
      ) {
        // Remove leading slash from pathname
        return urlObj.pathname.replace(/^\//, '');
      }

      // Format: https://s3.amazonaws.com/bucket/key or https://s3.region.amazonaws.com/bucket/key
      if (
        urlObj.hostname.startsWith('s3.') ||
        urlObj.hostname === 's3.amazonaws.com'
      ) {
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length > 1) {
          // Remove bucket name (first part) and return the rest
          return pathParts.slice(1).join('/');
        }
      }

      // Fallback: just return the pathname without leading slash
      return urlObj.pathname.replace(/^\//, '');
    } catch {
      // Ignored: Invalid URL format passed, return null as fallback
      return null;
    }
  }
}
