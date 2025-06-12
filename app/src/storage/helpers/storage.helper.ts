import { BadRequestException, HttpStatus, Injectable, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigurationService } from '../../configuration/configuration.service';
import { RESPONSE_MESSAGES } from '../../common/constants/response-messages.constant';
import * as path from 'path';

@Injectable()
export class StorageHelper {
  constructor(private readonly configurationService: ConfigurationService) {}

    // File Validation Methods
  validateMimeType(mimeType: string, allowedMimeTypes: string[]): void {
    if (!allowedMimeTypes.includes(mimeType)) {
      throw new UnsupportedMediaTypeException(
        `${RESPONSE_MESSAGES.ERROR.INVALID_FILE_TYPE}: ${allowedMimeTypes.join(', ')}`
      );
    }
  }

  validateFileSize(fileSize: number, maxSize: number): void {
    if (fileSize > (maxSize * 1024 * 1024)) {
      throw new PayloadTooLargeException(
        `${RESPONSE_MESSAGES.ERROR.FILE_TOO_LARGE}: ${maxSize}MB`
      );
    }
  }

  getAllowedMimeTypes(entityType: string): string[] {
   if (entityType === 'lessonMedia' || entityType === 'lessonAssociatedMedia') {
        return this.configurationService.getValue('document_mime_type');
    }else{
        return this.configurationService.getValue('image_mime_type');
    }
  }

  getMaxFileSize(entityType: string): number {
    if (entityType === 'lessonMedia' || entityType === 'lessonAssociatedMedia') {
        return this.configurationService.getValue('document_filesize');
    }else{
        return this.configurationService.getValue('image_filesize');
    }
  }

  // Upload Path Methods
  getUploadPath(entityType: string, filename?: string): string {
   
    let basePath: string;

    switch (entityType) {
      case 'course':
        basePath = this.configurationService.getValue('courses_upload_path');
        break;
      case 'module':
        basePath = this.configurationService.getValue('modules_upload_path');
        break;
      case 'lesson':
        basePath = this.configurationService.getValue('lessons_upload_path');
        break;
      case 'lessonMedia':
        basePath = this.configurationService.getValue('lessons_media_upload_path');
        break;
      case 'lessonAssociatedMedia':
        basePath = this.configurationService.getValue('lessons_associated_media_upload_path');
        break;
      default:
        throw new BadRequestException(`${RESPONSE_MESSAGES.ERROR.INVALID_UPLOAD_TYPE}: ${entityType}`);
    }

    return filename ? path.join(basePath, filename).replace(/\\/g, '/') : basePath;
  }

  getFullPath(baseDir: string, relativePath: string): string {
    return path.join(baseDir, relativePath.replace(/^\/+/, ''));
  }

  // Storage Configuration Methods
  getStorageConfig() {
    const storageConfig = this.configurationService.getStorageConfig();
    const { region, accessKeyId, secretAccessKey, container, expiresIn } = storageConfig;

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new BadRequestException(RESPONSE_MESSAGES.ERROR.MISSING_AWS_CONFIG);
    }

    if (!container) {
      throw new BadRequestException(RESPONSE_MESSAGES.ERROR.MISSING_S3_BUCKET);
    }

    return {
      region,
      accessKeyId,
      secretAccessKey,
      container,
      expiresIn,
    };
  }

  getStorageProvider(): string {
    return this.configurationService.getValue('cloud_storage_provider', 'local');
  }
}