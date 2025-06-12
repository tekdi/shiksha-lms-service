import { Injectable } from '@nestjs/common';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { v4 as uuidv4 } from 'uuid';
import { IStorageService, PresignedUrlResponse } from '../interfaces/storage.interface';
import path from 'path';
import { StorageHelper } from '../helpers/storage.helper';

@Injectable()
export class S3StorageService implements IStorageService {
  private s3Client: S3Client;
  private bucket: string;
  private expiresIn: number;

  constructor(
    private readonly storageHelper: StorageHelper,
  ) {
    const storageConfig = this.storageHelper.getStorageConfig();
    const { region, accessKeyId, secretAccessKey, container, expiresIn } = storageConfig;

    const config = {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };

    this.s3Client = new S3Client(config);
    this.bucket = container;
    this.expiresIn = expiresIn;
  }

  async verifyCredentials(): Promise<boolean> {
    try {
      await this.s3Client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: '.test',
      }));
      return true;
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        return true; // Bucket exists and we have permissions
      }
      console.error("Credential verification failed:", error);
      return false;
    }
  }

  async getPresignedUrl(
    type: string,
    mimeType: string,
    fileName?: string,
  ): Promise<PresignedUrlResponse> {
    try {
      // Validate file type
      const allowedMimeTypes = this.storageHelper.getAllowedMimeTypes(type);

      this.storageHelper.validateMimeType(mimeType, allowedMimeTypes);

      // Generate unique file key with UUID
      const fileExt = mimeType.split('/')[1];
      const uniqueFileName = fileName ? `${fileName}-${uuidv4()}` : `${Date.now()}-${uuidv4()}`;
      const uploadPath = this.storageHelper.getUploadPath(type);
      const key = path.join(uploadPath, `${uniqueFileName}.${fileExt}`).replace(/\\/g, '/');

      // Generate Presigned POST Policy url
      const { url, fields } = await createPresignedPost(this.s3Client, {
        Bucket: this.bucket,
        Key: key,
        Conditions: [
          ['content-length-range', 0, this.storageHelper.getMaxFileSize(type)],
          ['eq', '$Content-Type', mimeType],
          ['eq', '$key', key],
        ],
        Expires: this.expiresIn,
        Fields: {
          'Content-Type': mimeType,
          'key': key,
        },
      });

      return {
        url,
        key,
        fields,
        expiresIn: this.expiresIn,
      };
    } catch (error) {
      console.error('Presigned URL Error:', error);
      throw error;
    }
  }
} 