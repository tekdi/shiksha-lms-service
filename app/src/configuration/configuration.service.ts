import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigDto } from './dto/configuration.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { TenantContext } from '../common/tenant/tenant.context';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { TenantConfigValue } from './interfaces/tenant-config.interface';

@Injectable()
export class ConfigurationService {
  private lmsConfigJson: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly tenantContext: TenantContext,
  ) {
    // Initialize tenant configs in ConfigService if not exists
    const tenantId = this.tenantContext.getTenantId() || '';
    if (!this.configService.get(tenantId)) {
      this.configService.set(tenantId, {});
    }
    
    // Load LMS config
    this.loadLmsConfig();
  }

  async updateConfig(
    configData: ConfigDto,
    tenantId: string,
  ): Promise<any> {
    try {
      // Get current tenant config
      const tenantConfig = this.configService.get<TenantConfigValue>(tenantId) || { config: {} };
      
      // Create or update tenant configuration
      const updatedConfig: TenantConfigValue = {
        config: this.deepMerge(
          tenantConfig.config || {},
          configData.config
        )
      };
      
      // Update ConfigService
      this.configService.set(tenantId, updatedConfig);
      
      return {
        success: true,
        message: 'Configuration updated successfully',
        data: updatedConfig
      };
    } catch (error) {
      throw new InternalServerErrorException(`${RESPONSE_MESSAGES.ERROR.CONFIG_UPDATE_FAILED}: ${error.message}`);
    }
  }

  async syncExternalConfig(tenantId: string): Promise<any> {
    try {
      // Fetch configuration from external service
      const externalConfig = await this.fetchExternalConfig(tenantId);

      //if externalConfig is empty
      if (Object.keys(externalConfig).length === 0) {
        // if external config is not found, parse lms-config.json - only child properties with values
        const config = {};
        for (const section in this.lmsConfigJson.properties) {
          for (const property in this.lmsConfigJson.properties[section].properties) {
            if (this.lmsConfigJson.properties[section].properties[property].default) {
              config[property] = this.lmsConfigJson.properties[section].properties[property].default;
            }
          }
        }
        
        // Get current tenant config
        let tenantConfig = this.configService.get<TenantConfigValue>(tenantId) || { config: {} };
        
        // Ensure tenantConfig is an object
        if (typeof tenantConfig !== 'object' || tenantConfig === null) {
          this.configService.set(tenantId, { config: {} });
          tenantConfig = { config: {} };
        }
        
        // Update tenant config
        tenantConfig = {
          config: config,
          lastSynced: new Date().toISOString()
        };

        // Update ConfigService
        this.configService.set(tenantId, tenantConfig);

        return {
          success: true,
          message: RESPONSE_MESSAGES.ERROR.EXTERNAL_CONFIG_NOT_FOUND,
          data: config
        };
      }

      // Get current tenant config
      let tenantConfig = this.configService.get<TenantConfigValue>(tenantId) || { config: {} };
      
      // Ensure tenantConfig is an object
      if (typeof tenantConfig !== 'object' || tenantConfig === null) {
        this.configService.set(tenantId, { config: {} });
        tenantConfig = { config: {} };
      }
      
      // Create or update tenant configuration with external data
      tenantConfig = {
        config: this.deepMerge(
          tenantConfig.config || {},
          externalConfig
        ),
        lastSynced: new Date().toISOString()
      };
      
      // Update ConfigService
      this.configService.set(tenantId, tenantConfig);
      
      return {
        success: true,
        message: 'External configuration synced successfully',
        data: tenantConfig
      };
    } catch (error) {
      throw new InternalServerErrorException(`${RESPONSE_MESSAGES.ERROR.EXTERNAL_CONFIG_SYNC_FAILED}: ${error.message}`);
    }
  }

  async fetchExternalConfig(tenantId: string): Promise<any> {
    try {
      const externalConfigUrl = this.configService.get('EXTERNAL_CONFIG_URL');
      if (!externalConfigUrl) {
        throw new InternalServerErrorException(RESPONSE_MESSAGES.ERROR.EXTERNAL_CONFIG_URL_MISSING);
      }

      const response = await firstValueFrom(
        this.httpService.get(`${externalConfigUrl}/${tenantId}`)
      );

      return response.data.result;
    } catch (error) {
      throw new InternalServerErrorException(`${error.message}`);
    }
  }

  private loadLmsConfig() {
    try {
      const lmsConfigPath = path.join(process.cwd(), 'src/lms-config.json');
      this.lmsConfigJson = JSON.parse(fs.readFileSync(lmsConfigPath, 'utf8'));
    } catch (error) {
      console.error('Error loading LMS configuration:', error);
    }
  }

  private deepMerge(target: any, source: any): any {
    const output = { ...target };
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  // LMS Config Service Methods
  getValue(key: string, defaultValue: any = null): any {
    // First try tenant-specific config if tenantId is provided
    const tenantId = this.tenantContext.getTenantId();
   
    if (tenantId) {
      const tenantConfig = this.configService.get<TenantConfigValue>(tenantId);
      if (tenantConfig?.config && tenantConfig.config[key] !== undefined) {
          return tenantConfig.config[key];
      }
    }

    // Then try environment variables
    const envValue = this.configService.get(key);
    if (envValue !== undefined) {
      return envValue;
    }
    
    // Finally try lms-config.json
    if (this.lmsConfigJson) {
      const lmsValue = this.getLmsConfigValue(key);
      if (lmsValue !== undefined) {
        return lmsValue;
      }
    }
    
    return defaultValue;
  }

  private getLmsConfigValue(key: string): any {
    // Helper function to search through lms-config.json structure
    const searchInProperties = (properties: any): any => {
      for (const section in properties) {
        const sectionProps = properties[section].properties;
        if (sectionProps && sectionProps[key]) {
          return sectionProps[key].default;
        }
      }
      return undefined;
    };

    return searchInProperties(this.lmsConfigJson.properties);
  }

  // Helper methods for specific configuration types
  getStorageConfig() {
    return {
      region: this.getValue('storage_region', ''),
      accessKeyId: this.getValue('storage_key', ''),
      secretAccessKey: this.getValue('storage_secret', ''),
      container: this.getValue('storage_container', ''),
      expiresIn: Number(this.getValue('presigned_url_expires_in', 300)), // 300 seconds
    };
  }

} 