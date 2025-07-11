import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { TenantConfigValue } from './interfaces/tenant-config.interface';
import { CacheService } from '../cache/cache.service';

export interface config {
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

@Injectable()
export class ConfigurationService  {
  private lmsConfigJson: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    // Load LMS config
    this.loadLmsConfig();
  }

  /**
   * Get tenant configuration with Redis caching
   */
  async getConfig(
    tenantId: string,
  ): Promise<Record<string, any>> {
    try {
      // Try to get from cache first     
      const cachedConfig = await this.cacheService.getTenantConfig(tenantId);
      
      if (cachedConfig && cachedConfig.IsConfigsSync == 1) {      
        return cachedConfig;
      }else{       
          throw new NotFoundException(RESPONSE_MESSAGES.ERROR.CONFIG_NOT_FOUND);
      }
    } catch (error) {     
      throw new NotFoundException(
        `${RESPONSE_MESSAGES.ERROR.CONFIG_FAILED}: ${error.message}`
      );
    }
  }

  /**
   * Sync tenant configuration and update cache
   */
  async syncTenantConfig(tenantId: string): Promise<any> {
      // Fetch configuration from external service
      const externalConfig = await this.fetchExternalConfig(tenantId);

      //if externalConfig is empty
      if (Object.keys(externalConfig).length === 0) {
        const tenantConfig = await this.loadLocalConfig(tenantId);
        return tenantConfig;
      }

      // Create tenant configuration with external data
      const tenantConfig: TenantConfigValue = {
        config: externalConfig,
        lastSynced: new Date().toISOString(),
        IsConfigsSync: 1
      };
      
      // Update cache (primary storage)
      await this.cacheService.setTenantConfig(tenantId, tenantConfig);
      return  tenantConfig;
  }

  /**
   * Load local configuration and update cache
   */
  async loadLocalConfig(tenantId: string): Promise<any> {
    // if external config is not found, parse lms-config.json - only child properties with values
    const config = {};
    for (const section in this.lmsConfigJson.properties) {
      for (const property in this.lmsConfigJson.properties[section].properties) {
        if (this.lmsConfigJson.properties[section].properties[property].default) {
          config[property] = this.lmsConfigJson.properties[section].properties[property].default;
        }
      }
    }
    
    // Create tenant config
    const tenantConfig: TenantConfigValue = {
      config: config,
      lastSynced: new Date().toISOString(),
      IsConfigsSync: 1
    };

    // Update cache (primary storage)
    await this.cacheService.setTenantConfig(tenantId, tenantConfig);

    return tenantConfig;
  }
  /**
   * Get tenant configuration directly from cache (for internal use)
   */
  async getTenantConfig(tenantId: string): Promise<TenantConfigValue | null> {
    return await this.cacheService.getTenantConfig(tenantId);
  }

  /**
   * Set tenant configuration directly to cache (for internal use)
   */
  async setTenantConfig(tenantId: string, config: TenantConfigValue): Promise<void> {
    await this.cacheService.setTenantConfig(tenantId, config);
  }

  async fetchExternalConfig(tenantId: string): Promise<any> {
    try {
      const externalConfigUrl = this.configService.get('CONFIG_URL');
      if (!externalConfigUrl) {
        throw new InternalServerErrorException(RESPONSE_MESSAGES.ERROR.CONFIG_URL_MISSING);
      }

      const response = await axios.get(`${externalConfigUrl}/${tenantId}?context=lms`);
      return response.data.result;
    } catch (error) {
      return {};
    }
  }

  private loadLmsConfig() {
    try {
      const lmsConfigPath = path.join(process.cwd(), this.configService.get('LMS_CONFIG_PATH') || 'src/lms-config.json');
      this.lmsConfigJson = JSON.parse(fs.readFileSync(lmsConfigPath, 'utf8'));
    } catch (error) {
      throw new InternalServerErrorException(RESPONSE_MESSAGES.ERROR.LMS_CONFIG_LOAD_FAILED);
    }
  }

  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  // Helper methods for specific configuration types
  private getStorageConfig(tenantConfig: TenantConfigValue) {
    return {
      cloudStorageProvider: tenantConfig.config['cloud_storage_provider'],
      region: tenantConfig.config['storage_region'],
      accessKeyId: tenantConfig.config['storage_key'],
      secretAccessKey: tenantConfig.config['storage_secret'],
      container: tenantConfig.config['storage_container'],
      expiresIn: Number(tenantConfig.config['presigned_url_expires_in']),
    };
  }

  getEntityConfigs(entityType: string, tenantConfig: TenantConfigValue): config {
    const entityConfigMap = {
      course: {
        path: 'courses_upload_path',
        maxFileSize: 'image_filesize',
        allowedMimeTypes: 'image_mime_type'
      },
      module: {
        path: 'modules_upload_path',
        maxFileSize: 'image_filesize',
        allowedMimeTypes: 'image_mime_type'
      },
      lesson: {
        path: 'lessons_upload_path',
        maxFileSize: 'image_filesize',
        allowedMimeTypes: 'image_mime_type'
      },
      lessonMedia: {
        path: 'lessons_media_upload_path',
        maxFileSize: 'lessons_media_max_file_size',
        allowedMimeTypes: 'lessons_media_allowed_mime_types'
      },
      lessonAssociatedMedia: {
        path: 'lessons_associated_media_upload_path',
        maxFileSize: 'lessons_associated_media_max_file_size',
        allowedMimeTypes: 'lessons_associated_media_allowed_mime_types'
      }
    };

    const config = entityConfigMap[entityType];
    if (!config) {
      throw new BadRequestException(`${RESPONSE_MESSAGES.ERROR.INVALID_UPLOAD_TYPE}: ${entityType}`);
    }

    return {
      path: tenantConfig.config[config.path],
      maxFileSize: tenantConfig.config[config.maxFileSize],
      allowedMimeTypes: tenantConfig.config[config.allowedMimeTypes],
      storageConfig: this.getStorageConfig(tenantConfig)
    };
  }

} 