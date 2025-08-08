import {
  Controller,
  Get,
  Query,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiQuery,
} from '@nestjs/swagger';
import { AspireLeaderService } from './aspire-leader.service';
import { CourseReportDto, CourseReportHeadersDto } from './dto/course-report.dto';
import { API_IDS } from '../common/constants/api-ids.constant';
import { ApiId } from '../common/decorators/api-id.decorator';
import { TenantOrg } from '../common/decorators/tenant-org.decorator';
import { CommonQueryDto } from 'src/common/dto/common-query.dto';

@ApiTags('Aspire Leader Reports')
@Controller('course')
export class AspireLeaderController {
  constructor(
    private readonly aspireLeaderService: AspireLeaderService,
  ) {}

  @Get('report')
  @ApiId(API_IDS.GET_COURSE_REPORT)
  @ApiOperation({ 
    summary: 'Generate course report',
    description: 'Generate course-level or lesson-level reports with user progress and activity data. Include lessonId for lesson-level report, omit for course-level report. Requires Authorization header for external API calls.'
  })
  @ApiQuery({ name: 'courseId', type: 'string', description: 'Target course ID', required: true })
  @ApiQuery({ name: 'cohortId', type: 'string', description: 'Associated cohort ID', required: true })
  @ApiQuery({ name: 'lessonId', type: 'string', description: 'Required only for content-level report', required: false })
  @ApiQuery({ name: 'offset', type: 'number', description: 'For pagination (default: 0)', required: false })
  @ApiQuery({ name: 'limit', type: 'number', description: 'For pagination (default: 10)', required: false })
  @ApiQuery({ name: 'sortBy', type: 'string', description: 'Field to sort by (e.g., progress)', required: false })
  @ApiQuery({ name: 'orderBy', type: 'string', enum: ['asc', 'desc'], description: 'Sort order', required: false })
  @ApiResponse({ 
    status: 200, 
    description: 'Course report generated successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid parameters or missing Authorization header' })
  @ApiResponse({ status: 404, description: 'Course or lesson not found' })
  async generateCourseReport(
    @Query() reportDto: CourseReportDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
    @Headers() headers: CourseReportHeadersDto,
  ): Promise<any> {
    return this.aspireLeaderService.generateCourseReport(
      reportDto,
      tenantOrg.tenantId,
      tenantOrg.organisationId,
      headers.authorization,
    );
  }
} 