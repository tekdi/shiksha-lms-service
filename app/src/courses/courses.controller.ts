import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  UseInterceptors,
  UploadedFile,
  InternalServerErrorException,
  Put,
  Logger,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiBody, 
  ApiConsumes,
} from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { API_IDS } from '../common/constants/api-ids.constant';
import { Course } from './entities/course.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { SearchCourseDto } from './dto/search-course.dto';
import { CommonQueryDto } from '../common/dto/common-query.dto';
import { ApiId } from '../common/decorators/api-id.decorator';
import { TenantOrg } from '../common/decorators/tenant-org.decorator';
import { FileUploadService } from '../common/utils/local-storage.service';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { CourseStructureDto } from '../courses/dto/course-structure.dto';
import { SearchCourseResponseDto } from './dto/search-course.dto';
import { CourseHierarchyFilterDto } from './dto/course-hierarchy-filter.dto';


@ApiTags('Courses')
@Controller('courses')
export class CoursesController {
  private readonly logger = new Logger(CoursesController.name);

  constructor(
    private readonly coursesService: CoursesService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  @Post()
  @ApiId(API_IDS.CREATE_COURSE)
  @ApiOperation({ summary: 'Create a new course' })
  @ApiBody({ type: CreateCourseDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Course created successfully', 
    type: Course 
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  async createCourse(
    @Body() createCourseDto: CreateCourseDto,
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {

    try {
      if (file) {
        // Upload file and get the path
        createCourseDto.image = await this.fileUploadService.uploadFile(file, { type: 'course' });
      }
    } catch (error) {
      // Log the detailed error internally for debugging
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error uploading file during course creation: ${errorMessage}`, errorStack);
      // Throw a generic error to prevent sensitive information leakage
      throw new InternalServerErrorException(RESPONSE_MESSAGES.ERROR.FAILED_TO_UPLOAD_FILE);
    }
    const course = await this.coursesService.create(
      createCourseDto,
      query.userId, 
      tenantOrg.tenantId,
      tenantOrg.organisationId,
    );
    return course;
  }

  @Get('search')
  @ApiId(API_IDS.SEARCH_COURSES)  
  @ApiOperation({ 
    summary: 'Search and filter courses',
    description: 'Search and filter courses with various criteria including keyword search and multiple filters'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Search results retrieved successfully',
    type: SearchCourseResponseDto
  })
  async searchCourses(
    @Query() searchDto: SearchCourseDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    return this.coursesService.search(
      searchDto,
      tenantOrg.tenantId,
      tenantOrg.organisationId
    );
  }

  @Get(':courseId')
  @ApiId(API_IDS.GET_COURSE_BY_ID)
  @ApiOperation({ summary: 'Get a course by ID' })
  @ApiParam({ name: 'courseId', type: 'string', format: 'uuid', description: 'Course ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Course retrieved successfully', 
    type: Course 
  })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async getCourseById(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    const course = await this.coursesService.findOne(
      courseId,
      tenantOrg.tenantId,
      tenantOrg.organisationId
    );
    return course;
  }

  @Get(':courseId/hierarchy')
  @ApiId(API_IDS.GET_COURSE_HIERARCHY)
  @ApiOperation({ summary: 'Get course hierarchy (with modules and lessons)' })
  @ApiParam({ name: 'courseId', type: 'string', format: 'uuid', description: 'Course ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Course hierarchy retrieved successfully',
    schema: {
      properties: {
        id: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        modules: { 
          type: 'array',
          items: {
            properties: {
              id: { type: 'string', format: 'uuid' },
              title: { type: 'string' },
              lessons: { type: 'array', items: { $ref: '#/components/schemas/Lesson' } }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async getCourseHierarchyById(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    const courseHierarchy = await this.coursesService.findCourseHierarchy(
      courseId,
      tenantOrg.tenantId,
      tenantOrg.organisationId
    );
    return courseHierarchy;
  }

  @Get(':courseId/hierarchy/tracking/:userId')
  @ApiId(API_IDS.GET_COURSE_HIERARCHY_WITH_TRACKING)
  @ApiOperation({ 
    summary: 'Get course hierarchy with user tracking information',
    description: 'Get course hierarchy with tracking. Use query parameters to filter: type=module (exclude lessons), type=lesson&moduleId=uuid (single module with lessons), or no type for complete hierarchy'
  })
  @ApiParam({ name: 'courseId', type: 'string', format: 'uuid', description: 'Course ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Course hierarchy with tracking retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async getCourseHierarchyWithTracking(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() filterDto: CourseHierarchyFilterDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    const courseHierarchyWithTracking = await this.coursesService.findCourseHierarchyWithTracking(
      courseId, 
      userId,
      tenantOrg.tenantId,
      tenantOrg.organisationId,
      filterDto.type,
      filterDto.moduleId
    );
    return courseHierarchyWithTracking;
  }

  @Patch(':courseId')
  @ApiId(API_IDS.UPDATE_COURSE)
  @ApiOperation({ summary: 'Update a course' })
  @ApiBody({ type: UpdateCourseDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Course updated successfully', 
    type: Course 
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  async updateCourse(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() updateCourseDto: UpdateCourseDto,
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {

    try {
      if (file) {
        // Upload file and get the path
        updateCourseDto.image = await this.fileUploadService.uploadFile(file, { 
          type: 'course',
        });
      }
    } catch (error) {
      // Log the detailed error internally for debugging
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error uploading file during course update: ${errorMessage}`, errorStack);
      // Throw a generic error to prevent sensitive information leakage
      throw new InternalServerErrorException(RESPONSE_MESSAGES.ERROR.FAILED_TO_UPLOAD_FILE);
    }

    const course = await this.coursesService.update(
      courseId,
      updateCourseDto,
      query.userId,
      tenantOrg.tenantId,
      tenantOrg.organisationId,
    );
    return course;
  }

  @Delete(':courseId')
  @ApiId(API_IDS.DELETE_COURSE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete (archive) a course' })
  @ApiParam({ name: 'courseId', type: 'string', format: 'uuid', description: 'Course ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Course deleted successfully',
    schema: {
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async deleteCourse(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    const result = await this.coursesService.remove(
      courseId,
      query.userId,
      tenantOrg.tenantId,
      tenantOrg.organisationId
    );
    return result;
  }

  @Post('/clone/:courseId')
  @ApiId(API_IDS.COPY_COURSE)
  @ApiOperation({ 
    summary: 'Copy a course with all its modules, lessons, and media',
    description: 'Creates a deep copy of the course including all modules, lessons, and associated media files'
  })
  @ApiParam({ name: 'courseId', type: 'string', format: 'uuid', description: 'Course ID to copy' })
  @ApiResponse({ 
    status: 201, 
    description: 'Course copied successfully', 
    type: Course 
  })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async cloneCourse(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    const copiedCourse = await this.coursesService.cloneCourse(
      courseId,
      query.userId,
      tenantOrg.tenantId,
      tenantOrg.organisationId,
    );
    return copiedCourse;
  }

  @Put(':courseId/structure')
  @ApiId(API_IDS.UPDATE_COURSE_STRUCTURE)
  @ApiOperation({ 
    summary: 'Update course structure',
    description: 'Update the entire course structure including module and lesson ordering, and moving lessons between modules'
  })
  @ApiParam({ name: 'courseId', type: 'string', format: 'uuid', description: 'Course ID' })
  @ApiBody({ type: CourseStructureDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Course structure updated successfully',
    schema: {
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid structure data or validation error' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async updateCourseStructure(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() courseStructureDto: CourseStructureDto,
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string }
  ) {
    try {
      const result = await this.coursesService.updateCourseStructure(
        courseId,
        courseStructureDto,
        query.userId,
        tenantOrg.tenantId,
        tenantOrg.organisationId
      );
      
      return result;
    } catch (error) {
      // Re-throw the error to let the global exception filter handle it
      throw error;
    }
  }
}
