import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpCode,
  Patch,
  HttpStatus,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { API_IDS } from '../common/constants/api-ids.constant';
import { CommonQueryDto } from '../common/dto/common-query.dto';
import { ApiId } from '../common/decorators/api-id.decorator';
import { FileUploadService } from '../common/utils/local-storage.service';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { Lesson, LessonFormat, LessonStatus } from './entities/lesson.entity';
import { TenantOrg } from '../common/decorators/tenant-org.decorator';
import { ParseEnumPipe } from '@nestjs/common';

@ApiTags('Lessons')
@Controller('lessons')
export class LessonsController {
  private readonly logger = new Logger(LessonsController.name);

  constructor(
    private readonly lessonsService: LessonsService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  @Post()
  @ApiId(API_IDS.CREATE_LESSON)
  @ApiOperation({ summary: 'Create a new lesson' })
  @ApiBody({ type: CreateLessonDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Lesson created successfully', 
    type: Lesson 
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  async createLesson(
    @Body() createLessonDto: CreateLessonDto,
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {

    try {
      if (file) {
        // Upload file and get the path
        createLessonDto.image = await this.fileUploadService.uploadFile(file, { type: 'lesson' });
      }
    } catch (error) {
      // Log the detailed error internally for debugging
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error uploading file during lesson creation: ${errorMessage}`, errorStack);
      // Throw a generic error to prevent sensitive information leakage
      throw new InternalServerErrorException(RESPONSE_MESSAGES.ERROR.FAILED_TO_UPLOAD_FILE);
    }

    const lesson = await this.lessonsService.create(
      createLessonDto,
      query.userId,
      tenantOrg.tenantId,
      tenantOrg.organisationId,
    );
    return lesson;
  }

  @Get()
  @ApiId(API_IDS.GET_ALL_LESSONS)
  @ApiOperation({ summary: 'Get all lessons' })
  @ApiResponse({ status: 200, description: 'Lessons retrieved successfully' })
  @ApiQuery({ name: 'status', required: false, enum: ['published', 'unpublished', 'archived'] })
  @ApiQuery({ name: 'format', required: false, enum: ['video', 'document', 'quiz', 'event', 'text_and_media'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAllLessons(
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
    @Query() paginationDto: PaginationDto,
    @Query('status', new ParseEnumPipe(LessonStatus, { optional: true })) status?: LessonStatus,
    @Query('format', new ParseEnumPipe(LessonFormat, { optional: true })) format?: LessonFormat,
  ) {
    return this.lessonsService.findAll(
      tenantOrg.tenantId,
      tenantOrg.organisationId,
      paginationDto,
      status as LessonStatus,
      format as LessonFormat
    );
  }
  
  @Get(':lessonId')
  @ApiId(API_IDS.GET_LESSON_BY_ID)
  @ApiOperation({ summary: 'Get lesson by ID' })
  @ApiResponse({ status: 200, description: 'Lesson retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiParam({ name: 'lessonId', type: String, format: 'uuid' })
  async getLessonById(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    return this.lessonsService.findOne(
      lessonId,
      tenantOrg.tenantId,
      tenantOrg.organisationId
    );
  }

  @Get('module/:moduleId')
  @ApiId(API_IDS.GET_LESSONS_BY_MODULE)
  @ApiOperation({ summary: 'Get lessons by module ID' })
  @ApiResponse({ status: 200, description: 'Lessons retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Module not found' })
  @ApiParam({ name: 'moduleId', type: String, format: 'uuid' })
  async getLessonsByModule(
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    return this.lessonsService.findByModule(
      moduleId,
      tenantOrg.tenantId,
      tenantOrg.organisationId
    );
  }

  @Patch(':lessonId')
  @ApiId(API_IDS.UPDATE_LESSON)
  @ApiOperation({ summary: 'Update a lesson' })
  @ApiBody({ type: UpdateLessonDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Lesson updated successfully', 
    type: Lesson 
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  async updateLesson(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() updateLessonDto: UpdateLessonDto,
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    
    try {
      if (file) {
        // Upload file and get the path
        updateLessonDto.image = await this.fileUploadService.uploadFile(file, { 
          type: 'lesson',
        });
      }
    } catch (error) {
      // Log the detailed error internally for debugging
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error uploading file during lesson update: ${errorMessage}`, errorStack);
      // Throw a generic error to prevent sensitive information leakage
      throw new InternalServerErrorException(RESPONSE_MESSAGES.ERROR.FAILED_TO_UPLOAD_FILE);
    }

    const lesson = await this.lessonsService.update(
      lessonId,
      updateLessonDto,
      query.userId,
      tenantOrg.tenantId,
      tenantOrg.organisationId,
    );
    return lesson;
  }

  @Delete(':lessonId')
  @ApiId(API_IDS.DELETE_LESSON)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete (archive) a lesson' })
  @ApiParam({ name: 'lessonId', type: 'string', format: 'uuid', description: 'Lesson ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lesson deleted successfully',
    schema: {
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  async deleteLesson(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    const result = await this.lessonsService.remove(
      lessonId,
      query.userId,
      tenantOrg.tenantId,
      tenantOrg.organisationId
    );
    return result;
  }

}
