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
  ): Promise<any> {
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
    let result: any;
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
  ): Promise<any> {
    // Query with INNER JOIN course and course track, LEFT JOIN with enrollment
    const enrollmentData = await this.courseTrackRepository
      .createQueryBuilder('courseTrack')
      .innerJoinAndSelect('courseTrack.course', 'course')
      .leftJoin(
        'user_enrollments',
        'enrollment',
        'enrollment.courseId = courseTrack.courseId AND enrollment.userId = courseTrack.userId AND enrollment.tenantId = courseTrack.tenantId'
      )
      .addSelect([
        'enrollment.enrollmentId',
        'enrollment.userId',
        'enrollment.status',
        'enrollment.enrolledAt',
        'enrollment.endTime'
      ])
      .where('courseTrack.courseId = :courseId', { courseId: reportDto.courseId })
      .andWhere('courseTrack.tenantId = :tenantId', { tenantId })
      .andWhere('courseTrack.organisationId = :organisationId', { organisationId })
      .andWhere('(enrollment.status IS NULL OR enrollment.status != :status)', { status: EnrollmentStatus.ARCHIVED })
      .orderBy(this.getSortField(reportDto.sortBy || 'progress', true), (reportDto.orderBy?.toUpperCase() as 'ASC' | 'DESC') || 'DESC')
      .addOrderBy('courseTrack.lastAccessedDate', 'DESC') // Secondary sort for consistent ordering
      .skip(reportDto.offset || 0)
      .take(reportDto.limit || 10)
      .getMany();

    // Get total count for pagination
    const totalCount = await this.courseTrackRepository
      .createQueryBuilder('courseTrack')
      .leftJoin(
        'user_enrollments',
        'enrollment',
        'enrollment.courseId = courseTrack.courseId AND enrollment.userId = courseTrack.userId AND enrollment.tenantId = courseTrack.tenantId'
      )
      .where('courseTrack.courseId = :courseId', { courseId: reportDto.courseId })
      .andWhere('courseTrack.tenantId = :tenantId', { tenantId })
      .andWhere('courseTrack.organisationId = :organisationId', { organisationId })
      .andWhere('(enrollment.status IS NULL OR enrollment.status != :status)', { status: EnrollmentStatus.ARCHIVED })
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

    // Create a map of user data for efficient lookup while preserving order
    const userDataMap = new Map(userData.map(user => [user.userId, user]));

    // Combine data and create report items - maintain the original database order
    const reportItems: any[] = [];

    for (const courseTrackData of enrollmentData) {
      const user = userDataMap.get(courseTrackData.userId);
      const course = courseTrackData['course'];
      const enrollment = courseTrackData['enrollment'];

      if (user) {
        // Calculate progress
        const progress = courseTrackData.noOfLessons > 0 
          ? Math.round((courseTrackData.completedLessons / courseTrackData.noOfLessons) * 100)
          : 0;

        reportItems.push({
          ...user,
          courseId: course.courseId,
          courseTitle: course.title,
          courseStatus: course.status,
          courseFeatured: course.featured,
          courseFree: course.free,
          courseStartDate: course.startDatetime?.toISOString(),
          courseEndDate: course.endDatetime?.toISOString(),
          // Course Track fields
          courseTrackId: courseTrackData.courseTrackId,
          courseTrackStartDate: courseTrackData.startDatetime?.toISOString(),
          courseTrackEndDate: courseTrackData.endDatetime?.toISOString(),
          noOfLessons: courseTrackData.noOfLessons || 0,
          completedLessons: courseTrackData.completedLessons || 0,
          courseTrackStatus: courseTrackData.status,
          lastAccessedDate: courseTrackData.lastAccessedDate?.toISOString(),
          // Enrollment fields
          enrollmentId: enrollment?.enrollmentId,
          enrollmentStatus: enrollment?.status,
          enrolledDate: enrollment?.enrolledAt?.toISOString(),
          completedDate: enrollment?.endTime?.toISOString(),
          progress: courseTrackData.completedLessons / courseTrackData.noOfLessons * 100 || 0,
        });
      }
    }

    // No need to apply pagination again since it's already applied at database level
    return {
      data: reportItems,
      totalElements: totalCount,
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
  ): Promise<any> {
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


    // Query with INNER JOIN lesson track and course, LEFT JOIN with enrollment
    const enrollmentData = await this.lessonTrackRepository
      .createQueryBuilder('lessonTrack')
      .innerJoinAndSelect('lessonTrack.course', 'course')
      .leftJoin(
        'user_enrollments',
        'enrollment',
        'enrollment.courseId = lessonTrack.courseId AND enrollment.userId = lessonTrack.userId AND enrollment.tenantId = lessonTrack.tenantId'
      )
      .addSelect([
        'enrollment.enrollmentId',
        'enrollment.userId',
        'enrollment.status',
        'enrollment.enrolledAt',
        'enrollment.endTime'
      ])
      .where('lessonTrack.lessonId = :lessonId', { lessonId: reportDto.lessonId })
      .andWhere('lessonTrack.courseId = :courseId', { courseId: reportDto.courseId })
      .andWhere('lessonTrack.tenantId = :tenantId', { tenantId })
      .andWhere('lessonTrack.organisationId = :organisationId', { organisationId })
      .andWhere('(enrollment.status IS NULL OR enrollment.status != :status)', { status: EnrollmentStatus.ARCHIVED })
      .orderBy(this.getSortField(reportDto.sortBy || 'progress', false), (reportDto.orderBy?.toUpperCase() as 'ASC' | 'DESC') || 'DESC')
      .addOrderBy('lessonTrack.updatedAt', 'DESC') // Tertiary sort by last update time
      .skip(reportDto.offset || 0)
      .take(reportDto.limit || 10)
      .getMany();

    // Get total count for pagination
    const totalCount = await this.lessonTrackRepository
      .createQueryBuilder('lessonTrack')
      .leftJoin(
        'user_enrollments',
        'enrollment',
        'enrollment.courseId = lessonTrack.courseId AND enrollment.userId = lessonTrack.userId AND enrollment.tenantId = lessonTrack.tenantId'
      )
      .where('lessonTrack.lessonId = :lessonId', { lessonId: reportDto.lessonId })
      .andWhere('lessonTrack.courseId = :courseId', { courseId: reportDto.courseId })
      .andWhere('lessonTrack.tenantId = :tenantId', { tenantId })
      .andWhere('lessonTrack.organisationId = :organisationId', { organisationId })
      .andWhere('(enrollment.status IS NULL OR enrollment.status != :status)', { status: EnrollmentStatus.ARCHIVED })
      .getCount();

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

    // Create a map of user data for efficient lookup while preserving order
    const userDataMap = new Map(userData.map(user => [user.userId, user]));

    // Combine data and create report items - maintain the original database order
    const reportItems: any[] = [];

    for (const lessonTrackData of enrollmentData) {
      const user = userDataMap.get(lessonTrackData.userId);
      const course = lessonTrackData['course'];
      const enrollment = lessonTrackData['enrollment'];

      if (user) {
        reportItems.push({
          // User fields
          ...user,
          // Course fields
          courseId: course.courseId,
          courseTitle: course.title,
          courseStatus: course.status,
          // Lesson fields
          lessonTitle: lesson.title,
          type: lesson.format,
          // Lesson Track fields
          lessonTrackId: lessonTrackData.lessonTrackId,
          attempt: lessonTrackData.attempt || 0,
          startedAt: lessonTrackData.startDatetime?.toISOString(),
          completedAt: lessonTrackData.endDatetime?.toISOString(),
          score: lessonTrackData.score || 0,
          lessonStatus: lessonTrackData.status,
          timeSpent: lessonTrackData.timeSpent || 0,
          completionPercentage: lessonTrackData.completionPercentage || 0,
        });
      }
    }

    // No need to apply pagination again since it's already applied at database level
    return {
      data: reportItems,
      totalElements: totalCount,
      offset: reportDto.offset || 0,
      limit: reportDto.limit || 10,
    };
  }

  /**
   * Fetch user data from external API
   */
  private async fetchUserData(userIds: string[], tenantId: string, organisationId: string, authorization: string): Promise<any[]> {
    try {
      const userServiceUrl = this.configService.get('USER_SERVICE_URL', '');

      if (!userServiceUrl) {
        throw new BadRequestException(RESPONSE_MESSAGES.ERROR.USER_SERVICE_URL_NOT_CONFIGURED);
      }

      const response = await axios.post(`${userServiceUrl}/list`, {
        filters: { userId: userIds },
        limit: userIds.length,
        includeCustomFields: false,
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
      
      // Filter out audit fields from user data
      return userDetails.map((user: any) => {
        const { createdBy, updatedBy, createdAt, updatedAt, ...userWithoutAudit } = user;
        return userWithoutAudit;
      });     
    } catch (error) {
      this.logger.error('Failed to fetch user data from external API', error);
      throw new BadRequestException(RESPONSE_MESSAGES.ERROR.FAILED_TO_FETCH_USER_DATA);
    }
  }

  /**
   * Get the correct field name for sorting
   */
  private getSortField(sortBy: string, isCourseLevel: boolean = true): string {
    if (isCourseLevel) {
      switch (sortBy) {
        case 'progress':
          return 'courseTrack.completedLessons'; 
        case 'lastAccessedDate':
          return 'courseTrack.lastAccessedDate';
        default:
          return 'courseTrack.completedLessons';
      }
    } else {
      switch (sortBy) {
        case 'progress':
          return 'lessonTrack.completionPercentage';
        case 'timeSpent':
          return 'lessonTrack.timeSpent';        
        default:
          return 'lessonTrack.completionPercentage';
      }
    }
  }


} 