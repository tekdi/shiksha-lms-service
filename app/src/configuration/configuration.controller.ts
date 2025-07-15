import { Controller, Post, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ConfigurationService } from './configuration.service';    
import { TenantOrg } from '../common/decorators/tenant-org.decorator';
import { response } from 'express';

@ApiTags('Configuration')
@Controller('config')
export class ConfigController {
  constructor(private readonly configurationService: ConfigurationService) {}

  @Get()
  @ApiOperation({ summary: 'Get LMS configuration' })
  @ApiResponse({ 
    status: 200, 
    description: 'Configuration retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async getConfig(
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    return this.configurationService.getConfig(
      tenantOrg.tenantId,
    );
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync configuration from external service' })
  @ApiResponse({ 
    status: 200, 
    description: 'Configuration synced successfully'
  })
  @ApiResponse({ status: 400, description: 'Invalid tenant ID' })
  @ApiResponse({ status: 500, description: 'Failed to sync configuration' })
  async syncTenantConfig(@TenantOrg() tenantOrg: { tenantId: string; organisationId: string }) {
    return this.configurationService.syncTenantConfig(tenantOrg.tenantId);
  }
} 