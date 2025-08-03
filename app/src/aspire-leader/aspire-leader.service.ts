import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Not, IsNull, In } from 'typeorm';
import { CourseStatus } from '../courses/entities/course.entity';
import { LessonStatus } from '../lessons/entities/lesson.entity';
import { EnrollmentStatus } from '../enrollments/entities/user-enrollment.entity';
import { Course } from '../courses/entities/course.entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { CourseTrack } from '../tracking/entities/course-track.entity';
import { LessonTrack } from '../tracking/entities/lesson-track.entity';
import { UserEnrollment } from '../enrollments/entities/user-enrollment.entity';
import { CourseReportDto } from './dto/course-report.dto';
import { CourseLevelReportItemDto, LessonLevelReportItemDto, CourseReportResponseDto } from './dto/course-report-response.dto';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';

@Injectable()
export class AspireLeaderService {
  private readonly logger = new Logger(AspireLeaderService.name);

  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(CourseTrack)
    private readonly courseTrackRepository: Repository<CourseTrack>,
    @InjectRepository(LessonTrack)
    private readonly lessonTrackRepository: Repository<LessonTrack>,
    @InjectRepository(UserEnrollment)
    private readonly userEnrollmentRepository: Repository<UserEnrollment>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate course report (course-level or lesson-level)
   */
  async generateCourseReport(
    reportDto: CourseReportDto,
    tenantId: string,
    organisationId: string,
    authorization: string,
  ): Promise<CourseReportResponseDto> {
    const startTime = Date.now();
    this.logger.log(`Generating course report for courseId: ${reportDto.courseId}, cohortId: ${reportDto.cohortId}`);

    // Validate course exists
    const course = await this.courseRepository.findOne({
      where: { 
        courseId: reportDto.courseId,
        tenantId,
        organisationId,
        status: Not(CourseStatus.ARCHIVED)
      } as FindOptionsWhere<Course>,
    });

    if (!course) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.COURSE_NOT_FOUND);
    }

    // Check if lesson-level report is requested
    let result: CourseReportResponseDto;
    if (reportDto.lessonId) {
      result = await this.generateLessonLevelReport(reportDto, course, tenantId, organisationId, authorization);
    } else {
      result = await this.generateCourseLevelReport(reportDto, course, tenantId, organisationId, authorization);
    }

    const duration = Date.now() - startTime;
    this.logger.log(`Report generated in ${duration}ms for courseId: ${reportDto.courseId}`);
    
    return result;
  }

  /**
   * Generate course-level report with optimized JOINs
   */
  private async generateCourseLevelReport(
    reportDto: CourseReportDto,
    course: Course,
    tenantId: string,
    organisationId: string,
    authorization: string,
  ): Promise<CourseReportResponseDto> {
    // Single query with JOINs to get enrollments and course tracking data
    const enrollmentData = await this.userEnrollmentRepository
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.course', 'course')
      .leftJoin(
        'course_track',
        'courseTrack',
        'courseTrack.courseId = enrollment.courseId AND courseTrack.userId = enrollment.userId AND courseTrack.tenantId = enrollment.tenantId'
      )
      .addSelect([
        'courseTrack.courseTrackId',
        'courseTrack.lastAccessedDate',
        'courseTrack.completedLessons',
        'courseTrack.noOfLessons',
        'courseTrack.status',
        'courseTrack.completedLessons / NULLIF(courseTrack.noOfLessons, 0) as progress'
      ])
      .where('enrollment.courseId = :courseId', { courseId: reportDto.courseId })
      .andWhere('enrollment.tenantId = :tenantId', { tenantId })
      .andWhere('enrollment.organisationId = :organisationId', { organisationId })
      .andWhere('enrollment.status != :status', { status: EnrollmentStatus.ARCHIVED })
      .orderBy(('courseTrack.' + reportDto.sortBy) as any || 'progress', (reportDto.orderBy as any) || 'desc')
      .skip(reportDto.offset || 0)
      .take(reportDto.limit || 10)
      .getMany();

    // Get total count for pagination
    const totalCount = await this.userEnrollmentRepository
      .createQueryBuilder('enrollment')
      .where('enrollment.courseId = :courseId', { courseId: reportDto.courseId })
      .andWhere('enrollment.tenantId = :tenantId', { tenantId })
      .andWhere('enrollment.organisationId = :organisationId', { organisationId })
      .andWhere('enrollment.status != :status', { status: EnrollmentStatus.ARCHIVED })
      .getCount();

    if (enrollmentData.length === 0) {
      return {
        data: [],
        totalElements: totalCount,
        offset: reportDto.offset || 0,
        limit: reportDto.limit || 10,
      };
    }

    const userIds = enrollmentData.map(enrollment => enrollment.userId);

    // Fetch user data from external API - limit matches the number of users we're requesting
    const userData = await this.fetchUserData(userIds, tenantId, organisationId, authorization);

    // Combine data and create report items
    const reportItems: CourseLevelReportItemDto[] = [];

    for (const enrollment of enrollmentData) {
      const user = userData.find(u => u.userId === enrollment.userId);
      const courseTrack = enrollment['courseTrack']; // Get from JOIN result
      const course = enrollment['course'];

      if (user) {
        reportItems.push({
          ...user,
          ...course,
          ...courseTrack,
        });
      }
    }

    // Apply pagination
    const paginatedItems = this.applyPagination(reportItems, reportDto.offset || 0, reportDto.limit || 10);

    return {
      data: paginatedItems,
      totalElements: reportItems.length,
      offset: reportDto.offset || 0,
      limit: reportDto.limit || 10,
    };
  }

  /**
   * Generate lesson-level report with optimized JOINs
   */
  private async generateLessonLevelReport(
    reportDto: CourseReportDto,
    course: Course,
    tenantId: string,
    organisationId: string,
    authorization: string,
  ): Promise<CourseReportResponseDto> {
    // Validate lesson exists
    const lesson = await this.lessonRepository.findOne({
      where: {
        lessonId: reportDto.lessonId,
        courseId: reportDto.courseId,
        tenantId,
        organisationId,
        status: Not(LessonStatus.ARCHIVED)
      } as FindOptionsWhere<Lesson>,
    });

    if (!lesson) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
    }


    // Single query with JOINs to get enrollments and latest lesson tracking data
    const enrollmentData = await this.userEnrollmentRepository
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.course', 'course')
      .leftJoin(
        'lesson_track',
        'lessonTrack',
        `lessonTrack.lessonId = :lessonId 
         AND lessonTrack.userId = enrollment.userId 
         AND lessonTrack.tenantId = enrollment.tenantId
         AND lessonTrack.attempt = (
           SELECT MAX(lt2.attempt) 
           FROM lesson_track lt2 
           WHERE lt2.lessonId = :lessonId 
           AND lt2.userId = enrollment.userId 
           AND lt2.tenantId = enrollment.tenantId
         )`,
        { lessonId: reportDto.lessonId }
      )
      .addSelect([
        'lessonTrack.lessonTrackId',
        'lessonTrack.attempt',
        'lessonTrack.timeSpent',
        'lessonTrack.completionPercentage',
        'lessonTrack.status',
        'lessonTrack.updatedAt'
      ])
      .where('enrollment.courseId = :courseId', { courseId: reportDto.courseId })
      .andWhere('enrollment.tenantId = :tenantId', { tenantId })
      .andWhere('enrollment.organisationId = :organisationId', { organisationId })
      .andWhere('enrollment.status != :status', { status: EnrollmentStatus.ARCHIVED })
      .orderBy(('lessonTrack.' + reportDto.sortBy) as any || 'completionPercentage', (reportDto.orderBy as any) || 'desc')
      .skip(reportDto.offset || 0)
      .take(reportDto.limit || 10)
      .getMany();

    if (enrollmentData.length === 0) {
      return {
        data: [],
        totalElements: 0,
        offset: reportDto.offset || 0,
        limit: reportDto.limit || 10,
      };
    }

    const userIds = enrollmentData.map(enrollment => enrollment.userId);

    // Fetch user data from external API - limit matches the number of users we're requesting
    const userData = await this.fetchUserData(userIds, tenantId, organisationId, authorization);

    // Combine data and create report items
    const reportItems: LessonLevelReportItemDto[] = [];

    for (const enrollment of enrollmentData) {
      const user = userData.find(u => u.userId === enrollment.userId);
      const lessonTrack = enrollment['lessonTrack']; // Get from JOIN result (already latest attempt)

      if (user) {
        reportItems.push({
          ...course,
          ...user,
          ...lessonTrack,
          lessonTitle: lesson.title,
          type: lesson.format,
        });
      }
    }

    // Sort data

    // Apply pagination
    const paginatedItems = this.applyPagination(reportItems, reportDto.offset || 0, reportDto.limit || 10);

    return {
      data: paginatedItems,
      totalElements: reportItems.length,
      offset: reportDto.offset || 0,
      limit: reportDto.limit || 10,
    };
  }

  /**
   * Fetch user data from external API
   */
  private async fetchUserData(userIds: string[], tenantId: string, organisationId: string, authorization: string): Promise<any[]> {
    try {
      const middlewareUrl = this.configService.get('MIDDLEWARE_URL', '');

      if (!middlewareUrl) {
        throw new BadRequestException(RESPONSE_MESSAGES.ERROR.MIDDLEWARE_URL_NOT_CONFIGURED);
      }

      const response = await axios.post(`${middlewareUrl}/user/v1/list`, {
        filters: { userId: userIds },
        limit: userIds.length,
        }, {
          headers: {
            'tenantid': tenantId,
            'organisationId': organisationId,
            'Authorization': authorization,
            'Content-Type': 'application/json'
          }
        });

      // Handle the actual response format from the user service
      const userDetails = response.data.result?.getUserDetails || [];
      return userDetails.map((user: any) => ({
        userId: user.userId,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
        email: user.email || user.username
      }));
    } catch (error) {
      this.logger.error('Failed to fetch user data from external API', error);
      throw new BadRequestException(RESPONSE_MESSAGES.ERROR.FAILED_TO_FETCH_USER_DATA);
    }
  }

  /**
   * Apply pagination to report data
   */
  private applyPagination<T extends any[]>(
    data: T,
    offset: number,
    limit: number
  ): T {
    return data.slice(offset, offset + limit) as T;
  }
} 