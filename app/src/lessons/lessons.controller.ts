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
  FileTypeValidator,
  ParseFilePipe,
  MaxFileSizeValidator,
  Put,
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
import { AddLessonToCourseDto } from './dto/add-lesson-to-course.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { API_IDS } from '../common/constants/api-ids.constant';
import { CommonQueryDto } from '../common/dto/common-query.dto';
import { ApiId } from '../common/decorators/api-id.decorator';
import { Lesson } from './entities/lesson.entity';
import { getUploadPath } from '../common/utils/upload.util';
import { uploadConfigs } from '../config/file-validation.config';

@ApiTags('Lessons')
@Controller('lessons')
export class LessonsController   {
  constructor(
    private readonly lessonsService: LessonsService,
  ) {
  }

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
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', uploadConfigs.lessons))
  async createLesson(
    @Body() createLessonDto: CreateLessonDto,
    @Query() query: CommonQueryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      const imagePath = getUploadPath('lesson', file.filename);
      createLessonDto.image = imagePath;
    }
    const lesson = await this.lessonsService.create(
      createLessonDto,
      query.userId,
      query.tenantId,
      query.organisationId,
    );
    return lesson;
  }

  @Get()
  @ApiId(API_IDS.GET_ALL_LESSONS)
  @ApiOperation({ summary: 'Get all lessons' })
  @ApiResponse({ status: 200, description: 'Lessons retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiQuery({ name: 'status', required: false, enum: ['published', 'unpublished', 'archived'] })
  @ApiQuery({ name: 'format', required: false, enum: ['video', 'document', 'quiz', 'event'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAllLessons(
    @Query() paginationDto: PaginationDto,
    @Query() query: CommonQueryDto,
    @Query('status') status?: string,
    @Query('format') format?: string,
  ) {
    return this.lessonsService.findAll(
      paginationDto, 
      status, 
      format, 
      query.tenantId,
      query.organisationId
    );
  }

  @Post('course/:courseId/module/:moduleId')
  @ApiId(API_IDS.ADD_LESSON_TO_COURSE)
  @ApiOperation({ summary: 'Add lesson to course/module' })
  @ApiResponse({ status: 201, description: 'Lesson added to course successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Lesson or course/module not found' })
  @ApiParam({ name: 'courseId', description: 'UUID of the course' })
  @ApiParam({ name: 'moduleId', description: 'UUID of the module' })
  @ApiBody({ type: AddLessonToCourseDto })
  async addLessonToCourse(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() addLessonToCourseDto: AddLessonToCourseDto,
    @Query() query: CommonQueryDto
  ) {
    return this.lessonsService.addToCourse(
      addLessonToCourseDto,
      courseId,
      moduleId,
      query.userId,
      query.tenantId,
      query.organisationId
    );
  }

  @Get(':lessonId')
  @ApiOperation({ summary: 'Get lesson by ID' })
  @ApiResponse({ status: 200, description: 'Lesson retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiParam({ name: 'lessonId', type: String, format: 'uuid' })
  async getLessonById(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Query() query: CommonQueryDto,
  ) {
    return this.lessonsService.findOne(
      lessonId,
      query.userId,
      query.tenantId,
      query.organisationId
    );
  }

  @Get('module/:moduleId')
  @ApiOperation({ summary: 'Get lessons by module ID' })
  @ApiResponse({ status: 200, description: 'Lessons retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Module not found' })
  @ApiParam({ name: 'moduleId', type: String, format: 'uuid' })
  async getLessonsByModule(
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Query() query: CommonQueryDto,
  ) {
    return this.lessonsService.findByModule(
      moduleId,
      query.tenantId,
      query.organisationId
    );
  }

  @Put(':id')
  @ApiId(API_IDS.UPDATE_LESSON)
  @ApiOperation({ summary: 'Update a lesson' })
  @ApiBody({ type: UpdateLessonDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Lesson updated successfully', 
    type: Lesson 
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', uploadConfigs.lessons))
  async updateLesson(
    @Param('id') id: string,
    @Body() updateLessonDto: UpdateLessonDto,
    @Query() query: CommonQueryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      const imagePath = getUploadPath('lesson', file.filename);
      updateLessonDto.image = imagePath;
    }
    const lesson = await this.lessonsService.update(
      id,
      updateLessonDto,
      query.userId,
      query.tenantId,
      query.organisationId,
    );
    return lesson;
  }

  @Delete(':lessonId')
  @ApiOperation({ summary: 'Delete a lesson' })
  @ApiResponse({ status: 200, description: 'Lesson deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiParam({ name: 'lessonId', type: String, format: 'uuid' })
  async deleteLesson(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Query() query: CommonQueryDto,
  ) {
    return this.lessonsService.remove(
      lessonId,
      query.tenantId,
      query.organisationId
    );
  }

  @Delete('course/:courseLessonId')
  @ApiOperation({ summary: 'Remove lesson from course/module' })
  @ApiResponse({ status: 200, description: 'Lesson removed from course successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Course lesson association not found' })
  @ApiParam({ name: 'courseLessonId', type: String, format: 'uuid' })
  async removeLessonFromCourse(
    @Param('courseLessonId', ParseUUIDPipe) courseLessonId: string,
    @Query() query: CommonQueryDto,
  ) {
    return this.lessonsService.removeFromCourse(
      courseLessonId,
      query.tenantId,
      query.organisationId
    );
  }

  @Get(':lessonId/display')
  @ApiOperation({ summary: 'Get lesson to display' })
  @ApiResponse({ status: 200, description: 'Lesson retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiParam({ name: 'lessonId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'courseLessonId', required: false, type: String, format: 'uuid' })
  async getLessonToDisplay(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Query() query: CommonQueryDto,
    @Query('courseLessonId') courseLessonId?: string,
  ) {
    return this.lessonsService.findToDisplay(
      lessonId,
      query.tenantId,
      query.organisationId,
      courseLessonId
    );
  }
}
