import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigurationService } from '../../configuration/configuration.service';
import { RESPONSE_MESSAGES } from '../../common/constants/response-messages.constant';
import { TenantContext } from '../tenant/tenant.context';
import { CacheService } from '../../cache/cache.service';

interface Config {
  path: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
  storageConfig: {
    cloudStorageProvider: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    container: string;
    expiresIn: number;
  };
}

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

  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly tenantContext: TenantContext,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {
    // Get base upload directory from configuration or use a reliable fallback
    const configuredBaseDir = this.configService.get<string>('UPLOADS_BASE_PATH');
    if (configuredBaseDir) {
      this.baseUploadDir = configuredBaseDir;
    } else {
      // Use path relative to the current module's directory as fallback
      // This is more reliable than process.cwd() in production environments
      this.baseUploadDir = path.join(path.dirname(__dirname), '..', 'uploads');
    }
    
    // Ensure base upload directory exists
    if (!fs.existsSync(this.baseUploadDir)) {
      fs.mkdirSync(this.baseUploadDir, { recursive: true });
    }
  }

  async validateFile(file: Express.Multer.File, metadata: UploadMetadata, entityConfig: any): Promise<void> {
    // Validate file size
    if(entityConfig.maxFileSize){
      if (file.size > (entityConfig.maxFileSize * 1024 * 1024)) {
        throw new FileValidationError(
          `${RESPONSE_MESSAGES.ERROR.FILE_TOO_LARGE}: ${entityConfig.maxFileSize}MB`
        );
      }
    }else{
      throw new FileValidationError(
        `${RESPONSE_MESSAGES.ERROR.MAX_FILE_SIZE_NOT_FOUND}`
      );
    }

    // Validate mime type
    if(entityConfig.allowedMimeTypes){
      if (!entityConfig.allowedMimeTypes.includes(file.mimetype)) {
        throw new FileValidationError(
          `${RESPONSE_MESSAGES.ERROR.INVALID_FILE_TYPE}: ${entityConfig.allowedMimeTypes.join(', ')}`
        );
      }
    }else{
      throw new FileValidationError(
        `${RESPONSE_MESSAGES.ERROR.ALLOWED_MIME_TYPES_NOT_FOUND}`
      );
    }
  }

  async uploadFile(file: Express.Multer.File, metadata: UploadMetadata): Promise<string> {
    const tenantId = this.tenantContext.getTenantId() || '';
    const cachedConfig = await this.cacheService.getTenantConfig(tenantId);

    
    let entityConfig:any
    // If config is synced, return entity config directly
    if (cachedConfig && cachedConfig.IsConfigsSync == 1) {
      entityConfig = this.configurationService.getEntityConfigs(metadata.type, cachedConfig);
    }
    if(entityConfig){      

        await this.validateFile(file, metadata, entityConfig);

        const uploadDir = path.join(this.baseUploadDir, entityConfig.path);
        
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileName = `${uuidv4()}${path.extname(file.originalname)}`;
        const filePath = path.join(uploadDir, fileName);

        // Write file to disk
        await fs.promises.writeFile(filePath, file.buffer);

        // Return the relative path
        return path.join(entityConfig.path, fileName);
      }else {
        throw new BadRequestException(RESPONSE_MESSAGES.ERROR.CONFIG_NOT_FOUND);
      }
  }

  async deleteFile(filePath: string, metadata: UploadMetadata): Promise<void> {
    const tenantId = this.tenantContext.getTenantId() || '';
    const cachedConfig = await this.cacheService.getTenantConfig(tenantId);

    if (cachedConfig && cachedConfig.IsConfigsSync == 1) {
      const entityConfig = this.configurationService.getEntityConfigs(metadata.type, cachedConfig);
      const storageProvider = entityConfig.storageConfig.cloudStorageProvider;

      if (storageProvider === 'local') {
        // Validate that the file path belongs to the tenant
        const normalizedFilePath = path.normalize(filePath);
        const expectedBasePath = path.normalize(entityConfig.path);
        
        // Check if the normalized file path starts with the expected base path
        if (!normalizedFilePath.startsWith(expectedBasePath)) {
          throw new BadRequestException(RESPONSE_MESSAGES.ERROR.INVALID_FILE_PATH);
        }

        const fullPath = path.join(this.baseUploadDir, filePath);
        if (fs.existsSync(fullPath)) {
          await fs.promises.unlink(fullPath);
        }
        return;
      }
    }
    
    // TODO: Implement cloud storage deletion
    throw new BadRequestException(RESPONSE_MESSAGES.ERROR.FILE_DELETION_NOT_IMPLEMENTED);
  }
} 