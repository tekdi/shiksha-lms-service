import { BadRequestException, Injectable } from '@nestjs/common';
import { IStorageService, PresignedUrlResponse, FileUploadResponse } from './interfaces/storage.interface';
import { S3StorageService } from './providers/s3-storage.service';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { StorageHelper } from './helpers/storage.helper';
import { ConfigurationService } from '../configuration/configuration.service';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class StorageService implements IStorageService {
  private storageDriver: IStorageService;

  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly moduleRef: ModuleRef,
    private readonly storageHelper: StorageHelper,
  ) {
    this.storageDriver = this.createStorageDriver();
  }

  private createStorageDriver(): IStorageService {
    const storageProvider = this.storageHelper.getStorageProvider();
    switch (storageProvider.toLowerCase()) {
      case 'aws':
        return this.moduleRef.get(S3StorageService, { strict: false });
      default:
        throw new BadRequestException(`${RESPONSE_MESSAGES.ERROR.UNSUPPORTED_STORAGE_PROVIDER}: ${storageProvider}`);
    }
  }

  async getPresignedUrl(
    type: string,
    mimeType: string,
    fileName?: string,
  ): Promise<PresignedUrlResponse> {
    return this.storageDriver.getPresignedUrl(type, mimeType, fileName);
  }

  async verifyCredentials(): Promise<boolean> {
    return this.storageDriver.verifyCredentials();
  }
} 