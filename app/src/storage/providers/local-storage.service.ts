import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, StorageEngine } from 'multer';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import { HttpStatus } from '@nestjs/common';
import { ConfigurationService } from '../../configuration/configuration.service';
import { StorageHelper } from '../helpers/storage.helper';
import { RESPONSE_MESSAGES } from '../../common/constants/response-messages.constant';
export class FileValidationError extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(message, status);
  }
}   

interface UploadMetadata {
  type: 'course' | 'module' | 'lesson' | 'lessonMedia' | 'lessonAssociatedMedia';
  }


@Injectable()
export class FileUploadService {
  private readonly baseUploadDir: string;

  private storageHelper: StorageHelper;

  constructor(
    private readonly configurationService: ConfigurationService
  ) {
    this.storageHelper = new StorageHelper(this.configurationService);

    // Set base upload directory relative to the application root
    this.baseUploadDir = path.join(process.cwd(), 'uploads');
    // Ensure base upload directory exists
    if (!fs.existsSync(this.baseUploadDir)) {
      fs.mkdirSync(this.baseUploadDir, { recursive: true });
    }
  }
  async validateFile(file: Express.Multer.File, metadata: UploadMetadata): Promise<void> {
    const allowedMimeTypes = this.storageHelper.getAllowedMimeTypes(metadata.type);
    const maxSize = this.storageHelper.getMaxFileSize(metadata.type);
    
    this.storageHelper.validateFileSize(file.size, maxSize);
    this.storageHelper.validateMimeType(file.mimetype, allowedMimeTypes);
  }

  async uploadFile(file: Express.Multer.File, metadata: UploadMetadata): Promise<string> {
    // Validate file first
    await this.validateFile(file, metadata);

    const uploadpath = this.storageHelper.getUploadPath(metadata.type);
    const uploadDir = this.storageHelper.getFullPath(process.cwd(), uploadpath);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `${uuidv4()}${path.extname(file.originalname)}`;
    const filePath = path.join(uploadDir, fileName);

    // Write file to disk
    await fs.promises.writeFile(filePath, file.buffer);

    // Return the relative path
    return this.storageHelper.getUploadPath(metadata.type, fileName);
  }

  async deleteFile(filePath: string): Promise<void> {
    const driver = this.storageHelper.getStorageProvider();

    if (driver === 'local') {
      const fullPath = this.storageHelper.getFullPath(process.cwd(), filePath);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
      return;
    }
    
    // TODO: Implement cloud storage deletion
    throw new BadRequestException(RESPONSE_MESSAGES.ERROR.FILE_DELETION_NOT_IMPLEMENTED + driver);
  }
} 