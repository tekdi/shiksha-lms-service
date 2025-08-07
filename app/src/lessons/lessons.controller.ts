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
  Patch,
  Headers,
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
import { Lesson, LessonFormat, LessonStatus } from './entities/lesson.entity';
import { getUploadPath } from '../common/utils/upload.util';
import { uploadConfigs } from '../config/file-validation.config';
import { TenantOrg } from '../common/decorators/tenant-org.decorator';
import { ParseEnumPipe } from '@nestjs/common';
import { CloneLessonDto } from './dto/clone-lesson.dto';

@ApiTags('Lessons')
@Controller('lessons')
export class LessonsController {
  constructor(
    private readonly lessonsService: LessonsService,
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
  @UseInterceptors(FileInterceptor('image', uploadConfigs.lessons))
  async createLesson(
    @Body() createLessonDto: CreateLessonDto,
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      const imagePath = getUploadPath('lesson', file.filename);
      createLessonDto.image = imagePath;
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

  @Get('test/:testId')
  @ApiId(API_IDS.GET_LESSON_BY_TEST_ID)
  @ApiOperation({ summary: 'Get lesson details by test ID' })
  @ApiResponse({ status: 200, description: 'Lesson retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiQuery({ name: 'testId', required: true, type: String })
  async getLessonByTestId(
    @Param('testId', ParseUUIDPipe) testId: string,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    return this.lessonsService.findByTestId(
      testId,
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
  @UseInterceptors(FileInterceptor('image', uploadConfigs.lessons))
  async updateLesson(
    @Param('lessonId') lessonId: string,
    @Body() updateLessonDto: UpdateLessonDto,
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string }, 
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      const imagePath = getUploadPath('lesson', file.filename);
      updateLessonDto.image = imagePath;
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
  @ApiOperation({ summary: 'Delete a lesson' })
  @ApiResponse({ status: 200, description: 'Lesson deleted successfully' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiParam({ name: 'lessonId', type: String, format: 'uuid' })
  async deleteLesson(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    return this.lessonsService.remove(
      lessonId,
      query.userId,
      tenantOrg.tenantId,
      tenantOrg.organisationId
    );
  }

  @Post(':lessonId/clone')
  @ApiId(API_IDS.CLONE_LESSON)
  @ApiOperation({ summary: 'Clone a lesson with all its media and associated files' })
  @ApiResponse({ 
    status: 201, 
    description: 'Lesson cloned successfully', 
    type: Lesson 
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiParam({ name: 'lessonId', type: String, format: 'uuid' })
  async cloneLesson(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Query() query: CommonQueryDto,
    @Body() requestBody: CloneLessonDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
    @Headers('authorization') authorization: string
  ) {
    return this.lessonsService.cloneLesson(
      lessonId,     
      query.userId,
      tenantOrg.tenantId,
      tenantOrg.organisationId,
      authorization,
      requestBody.newCourseId,
      requestBody.newModuleId,
    );
  }

}
