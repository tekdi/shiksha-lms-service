import { Body, Controller, Get, Param, Post,  Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { GetPresignedUrlDto } from './dto/get-presigned-url.dto';
import { TenantOrg } from '../common/decorators/tenant-org.decorator';
@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('presign-url')
  @ApiOperation({ summary: 'Get a pre-signed URL for file upload' })
  @ApiQuery({ type: GetPresignedUrlDto })
  @ApiResponse({
    status: 200,
    description: 'Returns a pre-signed URL for uploading a file',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The pre-signed URL for uploading the file',
        },
        key: {
          type: 'string',
          description: 'The key/path where the file will be stored',
        },
        expiresIn: {
          type: 'number',
          description: 'Number of seconds until the URL expires',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getPresignedUrl(  
    @Query() query: GetPresignedUrlDto,
  ) {
    return this.storageService.getPresignedUrl(
      query.type,
      query.mimeType,
      query.fileName,
    );
  }
} 