import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  ParseUUIDPipe
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiConsumes, 
  ApiParam, 
  ApiQuery
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { API_IDS } from '../common/constants/api-ids.constant';
import { CreateMediaDto } from './dto/create-media.dto';
import { CommonQueryDto } from '../common/dto/common-query.dto';
import { ApiId } from '../common/decorators/api-id.decorator';
import { getUploadPath } from '../common/utils/upload.util';
import { uploadConfigs } from '../config/file-validation.config';
import { TenantOrg } from '../common/decorators/tenant-org.decorator';
import { LessonFormat } from '../lessons/entities/lesson.entity';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @ApiId(API_IDS.UPLOAD_MEDIA)
  @ApiOperation({ summary: 'Upload media file' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Media uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @UseInterceptors(FileInterceptor('file', uploadConfigs.media))
  async uploadMedia(
    @Body() createMediaDto: CreateMediaDto,
    @UploadedFile() file: Express.Multer.File,
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
   // TODO: Check if file is required based on format - need to test file upload
    if (file) {
      const filePath = getUploadPath('lessonMedia', file.filename);
      createMediaDto.path = filePath;
    }

    return this.mediaService.uploadMedia(
      createMediaDto, 
      file,
      query.userId,
      tenantOrg.tenantId,
      tenantOrg.organisationId,
    );
  }

  @Get()
  @ApiId(API_IDS.GET_MEDIA_LIST)
  @ApiOperation({ summary: 'Get media list' })
  @ApiResponse({ status: 200, description: 'Media list retrieved successfully' })
  @ApiQuery({ name: 'format', required: false, enum: ['video', 'document', 'quiz', 'event'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMediaList(
    @Query() paginationDto: PaginationDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
    @Query('format') format?: string,
  ) {
    return this.mediaService.findAll(
      paginationDto, 
      { type: format },
      tenantOrg.tenantId,
      tenantOrg.organisationId,
    );
  }

  @Get(':mediaId')
  @ApiId(API_IDS.GET_MEDIA_BY_ID)
  @ApiOperation({ summary: 'Get media by ID' })
  @ApiParam({ name: 'mediaId', description: 'Media ID', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Media retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Media not found' })
  async getMediaById(
    @Param('mediaId', ParseUUIDPipe) mediaId: string, 
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    return this.mediaService.findOne(
      mediaId,
      tenantOrg.tenantId, 
      tenantOrg.organisationId
    );
  }

  @Post(':mediaId/associate/:lessonId')
  @ApiId(API_IDS.ASSOCIATE_MEDIA_WITH_LESSON)
  @ApiOperation({ summary: 'Associate media with lesson' })
  @ApiParam({ name: 'mediaId', description: 'Media ID', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'lessonId', description: 'Lesson ID', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Media associated successfully' })
  @ApiResponse({ status: 404, description: 'Media or lesson not found' })
  async associateMediaWithLesson(
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    return this.mediaService.associateWithLesson(
      mediaId, 
      lessonId, 
      query.userId, 
      tenantOrg.tenantId, 
      tenantOrg.organisationId
    );
  }

  @Delete(':mediaId')
  @ApiId(API_IDS.DELETE_MEDIA)
  @ApiOperation({ summary: 'Delete media' })
  @ApiParam({ name: 'mediaId', description: 'Media ID', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Media deleted successfully' })
  @ApiResponse({ status: 404, description: 'Media not found' })
  @ApiResponse({ status: 400, description: 'Media is associated with a lesson or associated file and cannot be deleted' })
  async deleteMedia(
    @Param('mediaId', ParseUUIDPipe) mediaId: string, 
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    return this.mediaService.remove(
      mediaId, 
      query.userId, 
      tenantOrg.tenantId, 
      tenantOrg.organisationId
    );
  }

  @Delete(':mediaId/associate/:lessonId')
  @ApiId(API_IDS.REMOVE_MEDIA_ASSOCIATION)
  @ApiOperation({ summary: 'Remove media association from lesson' })
  @ApiParam({ name: 'mediaId', description: 'Media ID', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'lessonId', description: 'Lesson ID', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Media association removed successfully' })
  @ApiResponse({ status: 404, description: 'Media or lesson not found' })
  async removeMediaAssociation(
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    return this.mediaService.removeAssociation(
      mediaId, 
      lessonId, 
      query.userId, 
      tenantOrg.tenantId, 
      tenantOrg.organisationId
    );
  }
}