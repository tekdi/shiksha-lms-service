import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Not,
  FindOptionsWhere,
  DataSource,
  In,
} from 'typeorm';
import {
  UserEnrollment,
  EnrollmentStatus,
} from './entities/user-enrollment.entity';
import { Course } from '../courses/entities/course.entity';
import { CourseStatus } from '../courses/entities/course.entity';
import { CourseTrack } from '../tracking/entities/course-track.entity';
import { TrackingStatus } from '../tracking/entities/course-track.entity';
import { CreateEnrollmentDto, CreateMultiUserEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { Lesson, LessonStatus } from '../lessons/entities/lesson.entity';
import {
  Module as CourseModule,
  ModuleStatus,
} from '../modules/entities/module.entity';
import {
  ModuleTrack,
  ModuleTrackStatus,
} from '../tracking/entities/module-track.entity';
import { LessonTrack } from '../tracking/entities/lesson-track.entity';
import { InjectDataSource } from '@nestjs/typeorm';
import { CacheConfigService } from '../cache/cache-config.service';
import {
  UsersEnrolledCoursesDto,
  UsersEnrolledCoursesResponseDto,
  UserEnrolledCourseDto,
} from './dto/search-enrolled-courses.dto';
import {
  DashboardByUserIdResponseDto,
  CategoryCountDto,
} from './dto/dashboard-by-user-id.dto';
import {
  CoachProgressDashboardResponseDto,
  PathwayCompletionDto,
  CoachProgressDto,
  CoachCertificateDto,
  CoachJourneyItemDto,
} from './dto/coach-progress-dashboard.dto';
import { UserCourseCertificate } from '../certificate/entities/user_certificates';
import axios from 'axios';

// Course metadata columns returned by users-courses (shared by the enrolled and not-enrolled queries)
const USER_COURSE_META_COLUMNS = [
  'course.courseId',
  'course.tenantId',
  'course.organisationId',
  'course.title',
  'course.alias',
  'course.shortDescription',
  'course.description',
  'course.image',
  'course.featured',
  'course.free',
  'course.status',
  'course.params',
  'course.ordering',
  'course.categoryIds',
  'course.createdAt',
  'course.updatedAt',
];

@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(EnrollmentsService.name);

  constructor(
    @InjectRepository(UserEnrollment)
    private readonly userEnrollmentRepository: Repository<UserEnrollment>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(CourseTrack)
    private readonly courseTrackRepository: Repository<CourseTrack>,
    @InjectRepository(CourseModule)
    private readonly moduleRepository: Repository<CourseModule>,
    @InjectRepository(ModuleTrack)
    private readonly moduleTrackRepository: Repository<ModuleTrack>,
    @InjectRepository(LessonTrack)
    private readonly lessonTrackRepository: Repository<LessonTrack>,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(UserCourseCertificate)
    private readonly userCertificateRepository: Repository<UserCourseCertificate>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly cacheConfig: CacheConfigService,
  ) { }

  /**
   * Enroll a user for multiple courses in bulk
   */
  async enroll(
    createEnrollmentDto: CreateEnrollmentDto,
    userId: string,
    tenantId: string,
    organisationId: string,
  ): Promise<{
    successfullyEnrolled: UserEnrollment[];
    alreadyEnrolledCourseIds: string[];
    failedCourseIds: string[];
  }> {
    this.logger.log(`Enrolling user in bulk: ${JSON.stringify(createEnrollmentDto)}`);
    const successfullyEnrolled: UserEnrollment[] = [];
    const alreadyEnrolledCourseIds: string[] = [];
    const failedCourseIds: string[] = [];

    const courseIds = createEnrollmentDto.courseId || [];

    for (const courseId of courseIds) {
      try {
        const enrollment = await this.enrollSingleCourse(
          courseId,
          createEnrollmentDto,
          userId,
          tenantId,
          organisationId,
        );
        successfullyEnrolled.push(enrollment);
      } catch (error) {
        if (error instanceof ConflictException) {
          this.logger.warn(`User ${createEnrollmentDto.learnerId} already enrolled in course ${courseId}.`);
          alreadyEnrolledCourseIds.push(courseId);
          continue;
        }
        this.logger.error(`Failed to enroll user ${createEnrollmentDto.learnerId} in course ${courseId}: ${error.message}`);
        failedCourseIds.push(courseId);
        continue;
      }
    }

    return {
      successfullyEnrolled,
      alreadyEnrolledCourseIds,
      failedCourseIds,
    };
  }

  /**
   * Enroll multiple learners for one or more courses in a single operation.
   * Each learner is processed independently through the existing enroll() flow,
   * so a failure for one learner does not affect the others.
   */
  async enrollMultipleUsers(
    createMultiUserEnrollmentDto: CreateMultiUserEnrollmentDto,
    userId: string,
    tenantId: string,
    organisationId: string,
  ): Promise<{
    totalLearners: number;
    results: {
      learnerId: string;
      successfullyEnrolled: UserEnrollment[];
      alreadyEnrolledCourseIds: string[];
      failedCourseIds: string[];
    }[];
  }> {
    const { learnerIds, ...enrollmentData } = createMultiUserEnrollmentDto;
    this.logger.log(
      `Enrolling ${learnerIds.length} learner(s) in course(s): ${JSON.stringify(enrollmentData.courseId)}`,
    );

    const results = await Promise.all(
      learnerIds.map(async (learnerId) => {
        // Build a fresh DTO per learner: enrollSingleCourse may mutate `status`
        // (admin approval), which must not leak across learners.
        const learnerEnrollmentDto: CreateEnrollmentDto = {
          ...enrollmentData,
          courseId: [...(enrollmentData.courseId || [])],
          learnerId,
        };

        const result = await this.enroll(
          learnerEnrollmentDto,
          userId,
          tenantId,
          organisationId,
        );

        return { learnerId, ...result };
      }),
    );

    return {
      totalLearners: learnerIds.length,
      results,
    };
  }

  /**
   * Enroll a user for a single course
   * @param courseId The specific course ID
   * @param createEnrollmentDto The enrollment data
   * @param organisationId The organization ID for data isolation
   */
  private async enrollSingleCourse(
    courseId: string,
    createEnrollmentDto: CreateEnrollmentDto,
    userId: string,
    tenantId: string,
    organisationId: string,
  ): Promise<UserEnrollment> {
    // Create a query runner for transaction
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Build where clause for course validation with data isolation
      const courseWhereClause: FindOptionsWhere<Course> = {
        courseId,
        tenantId,
        status: Not(CourseStatus.ARCHIVED),
        organisationId,
      };

      // Validate course exists with proper data isolation
      const course = await queryRunner.manager.findOne(Course, {
        where: courseWhereClause,
      });

      if (!course) {
        throw new NotFoundException(RESPONSE_MESSAGES.COURSE_NOT_FOUND);
      }

      // Check if admin approval is required
      if (course.adminApproval) {
        createEnrollmentDto.status = EnrollmentStatus.UNPUBLISHED;
      }

      // Build where clause for existing enrollment check with data isolation
      const enrollmentWhereClause: FindOptionsWhere<UserEnrollment> = {
        courseId,
        userId: createEnrollmentDto.learnerId,
        tenantId,
        organisationId,
      };

      // Check for existing active enrollment
      const existingEnrollment = await queryRunner.manager.findOne(
        UserEnrollment,
        {
          where: enrollmentWhereClause,
        },
      );

      if (existingEnrollment) {
        throw new ConflictException(RESPONSE_MESSAGES.ALREADY_ENROLLED);
      }

      // Calculate end time based on course settings
      let endTime: Date | null = null;
      if (course.endDatetime) {
        endTime = new Date(course.endDatetime);
      } else if (createEnrollmentDto.endTime) {
        endTime = new Date(createEnrollmentDto.endTime);
      }

      // Parse JSON params if they are provided as a string
      let params = createEnrollmentDto.params;
      if (typeof params === 'string') {
        try {
          params = JSON.parse(params);
        } catch (error) {
          this.logger.error(`Error parsing params JSON: ${error.message}`);
          throw new BadRequestException(
            RESPONSE_MESSAGES.ERROR.INVALID_PARAMS_FORMAT,
          );
        }
      }

      // Create new enrollment entity
      const enrollment = queryRunner.manager.create(UserEnrollment, {
        courseId,
        userId: createEnrollmentDto.learnerId,
        tenantId,
        organisationId,
        enrolledOnTime: new Date(),
        endTime: endTime || undefined,
        status: createEnrollmentDto.status || EnrollmentStatus.PUBLISHED,
        unlimitedPlan: createEnrollmentDto.unlimitedPlan || false,
        beforeExpiryMail: createEnrollmentDto.beforeExpiryMail || false,
        afterExpiryMail: createEnrollmentDto.afterExpiryMail || false,
        params: params,
        enrolledBy: userId,
        enrolledAt: new Date(),
      });

      // Save the enrollment
      const savedEnrollment = await queryRunner.manager.save(enrollment);

      // Get all published modules for the course
      const modules = await queryRunner.manager.find(CourseModule, {
        where: {
          courseId,
          tenantId,
          organisationId,
          status: ModuleStatus.PUBLISHED,
        },
      });

      // Count total lessons for the course (only published parent lessons in published modules with considerForPassing = true)
      const courseLessons = await queryRunner.manager
        .createQueryBuilder(Lesson, 'lesson')
        .innerJoin('lesson.module', 'module')
        .where('lesson.status = :lessonStatus', {
          lessonStatus: LessonStatus.PUBLISHED,
        })
        .andWhere('module.status = :moduleStatus', {
          moduleStatus: ModuleStatus.PUBLISHED,
        })
        .andWhere('module.courseId = :courseId', { courseId })
        .andWhere('lesson.tenantId = :tenantId', { tenantId })
        .andWhere('lesson.organisationId = :organisationId', { organisationId })
        .andWhere('lesson.considerForPassing = :considerForPassing', {
          considerForPassing: true,
        })
        .andWhere('lesson.parentId IS NULL') // Only count parent lessons, exclude child lessons
        .getCount();

      // Create course tracking record
      const courseTrack = queryRunner.manager.create(CourseTrack, {
        courseId,
        tenantId,
        organisationId,
        userId: createEnrollmentDto.learnerId,
        startDatetime: new Date(),
        noOfLessons: courseLessons,
        completedLessons: 0,
        status: TrackingStatus.STARTED,
        lastAccessedDate: new Date(),
      });

      await queryRunner.manager.save(courseTrack);

      // Create module tracking records for each published module (bulk approach)
      if (modules.length > 0) {
        // Step 1: Preload lesson counts for all modules in a single query
        const moduleIds = modules.map((m) => m.moduleId);

        const lessonCounts = await queryRunner.manager
          .createQueryBuilder(Lesson, 'lesson')
          .select('lesson.moduleId', 'moduleId')
          .addSelect('COUNT(*)', 'count')
          .where('lesson.moduleId IN (:...moduleIds)', { moduleIds })
          .andWhere('lesson.status = :lessonStatus', {
            lessonStatus: LessonStatus.PUBLISHED,
          })
          .andWhere('lesson.tenantId = :tenantId', { tenantId })
          .andWhere('lesson.organisationId = :organisationId', {
            organisationId,
          })
          .andWhere('lesson.considerForPassing = :considerForPassing', {
            considerForPassing: true,
          })
          .andWhere('lesson.parentId IS NULL') // Only count parent lessons, exclude child lessons
          .groupBy('lesson.moduleId')
          .getRawMany();

        // Step 2: Build a map of moduleId to lesson count
        const lessonCountMap = new Map<string, number>();
        lessonCounts.forEach((row) => {
          lessonCountMap.set(row.moduleId, parseInt(row.count, 10));
        });

        // Step 3: Create ModuleTrack records
        const moduleTracks = modules.map((module) => {
          const totalLessons = lessonCountMap.get(module.moduleId) || 0;

          return queryRunner.manager.create(ModuleTrack, {
            moduleId: module.moduleId,
            tenantId,
            organisationId,
            userId: createEnrollmentDto.learnerId,
            status: ModuleTrackStatus.INCOMPLETE,
            completedLessons: 0,
            totalLessons,
            progress: 0,
          });
        });

        // Step 4: Bulk save
        await queryRunner.manager.save(ModuleTrack, moduleTracks);
      }

      // Find and return the complete enrollment with relations
      const completeEnrollment = await queryRunner.manager.findOne(
        UserEnrollment,
        {
          where: { enrollmentId: savedEnrollment.enrollmentId },
          // relations: ['course'],
        },
      );

      if (!completeEnrollment) {
        throw new InternalServerErrorException(
          RESPONSE_MESSAGES.ENROLLMENT_ERROR,
        );
      }

      // Commit the transaction
      await queryRunner.commitTransaction();

      // Cache the new enrollment and invalidate related caches (best-effort, non-blocking)
      // Cache operations are wrapped to prevent Redis errors from breaking requests
      const enrollmentKey = this.cacheConfig.getEnrollmentKey(
        savedEnrollment.userId,
        savedEnrollment.courseId,
        tenantId,
        organisationId,
      );
      try {
        await Promise.all([
          this.cacheService.invalidateEnrollment(
            savedEnrollment.userId,
            savedEnrollment.courseId,
            tenantId,
            organisationId,
          ),
          this.cacheService.set(
            enrollmentKey,
            savedEnrollment,
            this.cacheConfig.ENROLLMENT_TTL,
          ),
        ]);
      } catch (cacheError) {
        // Log cache operation failure but don't break the request
        // Cache is an optimization - API should work even if Redis is down
        this.logger.warn(
          `Failed to cache enrollment: ${cacheError.message}`
        );
      }

      return completeEnrollment;
    } catch (error) {
      // Rollback the transaction on error
      await queryRunner.rollbackTransaction();

      this.logger.error(`Error enrolling user: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        RESPONSE_MESSAGES.ENROLLMENT_ERROR,
      );
    } finally {
      // Release the query runner
      await queryRunner.release();
    }
  }

  /**
   * Enroll a user in all active courses for a given cohort
   */
  async enrollByCohort(
    learnerId: string,
    cohortId: string,
    userId: string,
    tenantId: string,
    organisationId: string,
  ): Promise<{
    successfullyEnrolled: UserEnrollment[];
    alreadyEnrolledCourseIds: string[];
    failedCourseIds: string[];
  }> {
    this.logger.log(`Enrolling learner ${learnerId} by cohort ${cohortId}`);

    // Find all published courses for the cohort
    const courses = await this.courseRepository
      .createQueryBuilder('course')
      .select('course.courseId')
      .where('course.tenantId = :tenantId', { tenantId })
      .andWhere('course.organisationId = :organisationId', { organisationId })
      .andWhere('course.status = :status', { status: CourseStatus.PUBLISHED })
      .andWhere("course.params->>'cohortId' = :cohortId", { cohortId })
      .getMany();

    if (!courses || courses.length === 0) {
      this.logger.log(`No active courses found for cohort ${cohortId}`);
      return { successfullyEnrolled: [], alreadyEnrolledCourseIds: [], failedCourseIds: [] };
    }

    const courseIds = courses.map((course) => course.courseId);

    // Call the bulk enroll method
    const createEnrollmentDto: CreateEnrollmentDto = {
      learnerId,
      courseId: courseIds,
      status: EnrollmentStatus.PUBLISHED,
    };

    return this.enroll(createEnrollmentDto, userId, tenantId, organisationId);
  }

  /**
   * Find all enrollments with pagination and filters
   */
  async findAll(
    tenantId: string,
    organisationId: string,
    paginationDto: PaginationDto,
    learnerId?: string,
    courseId?: string,
    status?: string,
  ): Promise<{ count: number; enrollments: UserEnrollment[] }> {
    try {
      const { page = 1, limit = 10 } = paginationDto;
      const skip = (page - 1) * limit;

      // Generate cache key using standardized pattern
      const cacheKey = this.cacheConfig.getEnrollmentListKey(
        tenantId,
        organisationId,
        learnerId || '',
        courseId || '',
        status || '',
        page,
        limit,
      );

      // Try to get from cache first
      const cachedResult = await this.cacheService.get<{
        count: number;
        enrollments: UserEnrollment[];
      }>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const whereConditions: FindOptionsWhere<UserEnrollment> = {
        tenantId,
        organisationId,
      };

      if (learnerId) {
        whereConditions.userId = learnerId;
      }
      if (courseId) {
        whereConditions.courseId = courseId;
      }
      if (status) {
        whereConditions.status = status as EnrollmentStatus;
      }

      // Execute query with pagination
      const [enrollments, count] =
        await this.userEnrollmentRepository.findAndCount({
          where: whereConditions,
          skip,
          take: limit,
          order: {
            enrolledOnTime: 'DESC',
          },
          // relations: ['course'],
        });

      const result = { count, enrollments };

      // Cache the result with standardized TTL (best-effort, non-blocking)
      // Cache writes are wrapped to prevent Redis errors from breaking requests
      try {
        await this.cacheService.set(
          cacheKey,
          result,
          this.cacheConfig.ENROLLMENT_TTL,
        );
      } catch (cacheError) {
        // Log cache write failure but don't break the request
        // Cache is an optimization - API should work even if Redis is down
        this.logger.warn(
          `Failed to cache enrollment list: ${cacheError.message}`
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`Error finding enrollments: ${error.message}`);
      throw new InternalServerErrorException(RESPONSE_MESSAGES.FETCH_ERROR);
    }
  }

  /**
   * Find a single enrollment by ID
   */
  async findOne(
    enrollmentId: string,
    tenantId: string,
    organisationId: string,
  ): Promise<UserEnrollment> {
    try {
      // Check cache using the enrollment's userId and courseId
      const cacheKey = this.cacheConfig.getUserEnrollmentKey(
        enrollmentId,
        tenantId,
        organisationId,
      );
      const cachedEnrollment =
        await this.cacheService.get<UserEnrollment>(cacheKey);

      if (cachedEnrollment) {
        return cachedEnrollment;
      }

      // Get enrollment from database first to get userId and courseId for cache key
      const enrollment = await this.userEnrollmentRepository.findOne({
        where: { enrollmentId, tenantId, organisationId },
        // relations: ['course'],
      });

      if (!enrollment) {
        throw new NotFoundException(RESPONSE_MESSAGES.ENROLLMENT_NOT_FOUND);
      }

      // Cache the enrollment with TTL (best-effort, non-blocking)
      // Cache writes are wrapped to prevent Redis errors from breaking requests
      try {
        await this.cacheService.set(
          cacheKey,
          enrollment,
          this.cacheConfig.ENROLLMENT_TTL,
        );
      } catch (cacheError) {
        // Log cache write failure but don't break the request
        // Cache is an optimization - API should work even if Redis is down
        this.logger.warn(
          `Failed to cache enrollment: ${cacheError.message}`
        );
      }

      return enrollment;
    } catch (error) {
      this.logger.error(`Error finding enrollment: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(RESPONSE_MESSAGES.FETCH_ERROR);
    }
  }

  /**
   * Search and filter enrolled courses
   *
   * This method assembles data from:
   * 1. User + cohort enrollment mapping (user-specific, NOT cached - always fetched from DB)
   * 2. Course metadata (shared, cacheable - cached when LMS_CACHE_ENABLED=true)
   *
   * We do NOT cache the full API response because:
   * - Enrollment data is user-specific and must be fresh
   * - Different users may have different enrollments for the same course
   * - Caching full responses would lead to stale or incorrect data
   *
   * We DO cache course metadata because:
   * - Course metadata (title, description, image, status, etc.) is shared across users
   * - Course metadata rarely changes
   * - Caching metadata reduces database load for frequently accessed courses
   */
  async usersEnrolledCourses(
    filters: UsersEnrolledCoursesDto,
    tenantId: string,
    organisationId: string,
  ): Promise<UsersEnrolledCoursesResponseDto> {
    try {
      const offset = Math.max(0, filters.offset || 0);
      const limit = Math.min(100, Math.max(1, filters.limit || 10));

      if (filters?.hasEnroll === false && filters.userId) {
        return await this.usersNotEnrolledCourses(
          filters,
          tenantId,
          organisationId,
          offset,
          limit,
        );
      }

      const enrolledCourseIds = await this.getEnrolledCourseIds(
        filters,
        tenantId,
        organisationId,
      );

      if (enrolledCourseIds.length === 0) {
        return { courses: [], totalElements: 0, offset, limit };
      }

      const groupKey = filters?.cohortId || filters?.pathwayId;
      const courses = await this.resolveCoursesWithCache(
        enrolledCourseIds,
        tenantId,
        organisationId,
        groupKey,
      );

      courses.sort((a, b) => (a.ordering || 0) - (b.ordering || 0));

      const total = courses.length;
      const paginatedCourses = courses.slice(offset, offset + limit);

      const coursesForResponse: UserEnrolledCourseDto[] =
        filters?.hasEnroll === true && filters.userId
          ? await this.attachUserCourseProgress(
            paginatedCourses,
            filters.userId,
            tenantId,
            organisationId,
          )
          : await this.attachTotalModuleCount(paginatedCourses, tenantId);

      return {
        courses: coursesForResponse,
        totalElements: total,
        offset,
        limit,
      };
    } catch (error) {
      this.logger.error(`Error searching enrolled courses: ${error.message}`);
      throw new InternalServerErrorException(RESPONSE_MESSAGES.FETCH_ERROR);
    }
  }

  private async getEnrolledCourseIds(
    filters: UsersEnrolledCoursesDto,
    tenantId: string,
    organisationId: string,
  ): Promise<string[]> {
    const qb = this.userEnrollmentRepository
      .createQueryBuilder('enrollment')
      .innerJoin('enrollment.course', 'course')
      .select(['enrollment.courseId', 'enrollment.userId', 'course.courseId'])
      .where('enrollment.tenantId = :tenantId', { tenantId })
      .andWhere('enrollment.organisationId = :organisationId', {
        organisationId,
      })
      .andWhere('enrollment.status = :enrollmentStatus', {
        enrollmentStatus: EnrollmentStatus.PUBLISHED,
      })
      .andWhere('course.status = :coursePublishedStatus', {
        coursePublishedStatus: CourseStatus.PUBLISHED,
      });

    if (filters?.userId) {
      qb.andWhere('enrollment.userId = :userId', { userId: filters.userId });
    }

    if (filters?.hasEnroll === true && filters?.trackingStatus?.length && filters?.userId) {
      this.applyTrackingStatusFilter(qb, filters.trackingStatus);
    }

    if (filters?.cohortId) {
      qb.andWhere("course.params->>'cohortId' = :cohortId", {
        cohortId: filters.cohortId,
      });
    }

    if (filters?.pathwayId) {
      qb.andWhere("course.params->>'pathwayId' = :pathwayId", {
        pathwayId: filters.pathwayId,
      });
    }

    const categoryIds = this.getCategoryIdsFilter(filters);
    if (categoryIds?.length) {
      qb.andWhere('course.categoryIds && :categoryIds', {
        categoryIds,
      });
    }

    const enrollments = await qb.getMany();
    return [...new Set(enrollments.map((e) => e.courseId))];
  }

  private applyTrackingStatusFilter(qb: any, statuses: TrackingStatus[]): void {
    const hasStatusMatch =
      'EXISTS (SELECT 1 FROM "course_track" "ct" WHERE "ct"."courseId" = "course"."courseId" AND "ct"."userId" = :userId AND "ct"."tenantId" = :tenantId AND "ct"."organisationId" = :organisationId AND "ct"."status" IN (:...trackingStatuses))';
    // A course without a course_track row also counts as not started
    if (statuses.includes(TrackingStatus.NOT_STARTED)) {
      qb.andWhere(
        '(NOT EXISTS (SELECT 1 FROM "course_track" "ct" WHERE "ct"."courseId" = "course"."courseId" AND "ct"."userId" = :userId AND "ct"."tenantId" = :tenantId AND "ct"."organisationId" = :organisationId) OR ' +
          hasStatusMatch +
          ')',
        { trackingStatuses: statuses },
      );
    } else {
      qb.andWhere(hasStatusMatch, { trackingStatuses: statuses });
    }
  }

  private async resolveCoursesWithCache(
    enrolledCourseIds: string[],
    tenantId: string,
    organisationId: string,
    groupKey?: string,
  ): Promise<Course[]> {
    const cachedResults = await Promise.all(
      enrolledCourseIds.map(async (courseId) => ({
        courseId,
        cachedMeta: await this.cacheService.getCourseMetaCached(
          courseId,
          groupKey,
        ),
      })),
    );

    const courses: Course[] = [];
    const courseIdsToFetch: string[] = [];

    for (const { courseId, cachedMeta } of cachedResults) {
      if (cachedMeta) {
        courses.push(cachedMeta as Course);
      } else {
        courseIdsToFetch.push(courseId);
      }
    }

    if (courseIdsToFetch.length > 0) {
      const fetchedCourses = await this.fetchAndCacheCoursesMetadata(
        courseIdsToFetch,
        tenantId,
        organisationId,
        groupKey,
      );
      courses.push(...fetchedCourses);
    }

    return courses.filter((c) => c.status === CourseStatus.PUBLISHED);
  }

  private async fetchAndCacheCoursesMetadata(
    courseIdsToFetch: string[],
    tenantId: string,
    organisationId: string,
    groupKey?: string,
  ): Promise<Course[]> {
    const fetchedCourses = await this.courseRepository
      .createQueryBuilder('course')
      .select(USER_COURSE_META_COLUMNS)
      .where('course.courseId IN (:...courseIds)', {
        courseIds: courseIdsToFetch,
      })
      .andWhere('course.tenantId = :tenantId', { tenantId })
      .andWhere('course.organisationId = :organisationId', { organisationId })
      .andWhere('course.status = :coursePublishedStatus', {
        coursePublishedStatus: CourseStatus.PUBLISHED,
      })
      .getMany();

    await Promise.all(
      fetchedCourses.map((course) =>
        this.cacheSingleCourseMeta(course, groupKey),
      ),
    );

    return fetchedCourses;
  }

  private async cacheSingleCourseMeta(
    course: Course,
    groupKey?: string,
  ): Promise<void> {
    const courseMeta = {
      courseId: course.courseId,
      tenantId: course.tenantId,
      organisationId: course.organisationId,
      title: course.title,
      alias: course.alias,
      shortDescription: course.shortDescription,
      description: course.description,
      image: course.image,
      featured: course.featured,
      free: course.free,
      status: course.status,
      params: course.params,
      ordering: course.ordering,
      categoryIds: course.categoryIds,
      prerequisites: course.prerequisites,
      certificateTerm: course.certificateTerm,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };

    try {
      await this.cacheService.setCourseMetaCached(
        course.courseId,
        courseMeta,
        groupKey,
      );
    } catch (cacheError) {
      this.logger.warn(
        `Failed to cache course metadata for courseId ${course.courseId}: ${cacheError.message}`,
      );
    }
  }

  /**
   * hasEnroll=false: published courses (same tenant/org/cohort/pathway filters and ordering as
   * users-courses) that the user has NO published enrollment for. The exclusion, ordering and
   * pagination all happen in one database query.
   */
  private async usersNotEnrolledCourses(
    filters: UsersEnrolledCoursesDto,
    tenantId: string,
    organisationId: string,
    offset: number,
    limit: number,
  ): Promise<UsersEnrolledCoursesResponseDto> {
    const queryBuilder = this.courseRepository
      .createQueryBuilder('course')
      .select(USER_COURSE_META_COLUMNS)
      .where('course.tenantId = :tenantId', { tenantId })
      .andWhere('course.organisationId = :organisationId', { organisationId })
      .andWhere('course.status = :coursePublishedStatus', {
        coursePublishedStatus: CourseStatus.PUBLISHED,
      })
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM "user_enrollments" "enrollment" ' +
        'WHERE "enrollment"."courseId" = "course"."courseId" ' +
        'AND "enrollment"."userId" = :userId ' +
        'AND "enrollment"."tenantId" = :tenantId ' +
        'AND "enrollment"."organisationId" = :organisationId ' +
        'AND "enrollment"."status" = :enrollmentStatus)',
        {
          userId: filters.userId,
          enrollmentStatus: EnrollmentStatus.PUBLISHED,
        },
      );

    if (filters?.cohortId) {
      queryBuilder.andWhere("course.params->>'cohortId' = :cohortId", {
        cohortId: filters.cohortId,
      });
    }
    if (filters?.pathwayId) {
      queryBuilder.andWhere("course.params->>'pathwayId' = :pathwayId", {
        pathwayId: filters.pathwayId,
      });
    }
    const categoryIds = this.getCategoryIdsFilter(filters);
    if (categoryIds?.length) {
      queryBuilder.andWhere('course.categoryIds && :categoryIds', {
        categoryIds,
      });
    }

    const [courses, totalElements] = await queryBuilder
      .orderBy('course.ordering', 'ASC')
      .addOrderBy('course.courseId', 'ASC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const coursesWithModuleCount = await this.attachTotalModuleCount(
      courses,
      tenantId,
    );

    return { courses: coursesWithModuleCount, totalElements, offset, limit };
  }

  private getCategoryIdsFilter(
    filters?: UsersEnrolledCoursesDto,
  ): string[] | undefined {
    if (filters?.categoryIds?.length) {
      return filters.categoryIds;
    }
    return undefined;
  }

  /**
   * Attaches totalModuleCount (count of non-archived modules) to a list of courses.
   */
  private async attachTotalModuleCount(
    courses: Course[],
    tenantId: string,
  ): Promise<UserEnrolledCourseDto[]> {
    if (courses.length === 0) return [];

    const courseIds = courses.map((c) => c.courseId);

    const counts = await this.moduleRepository
      .createQueryBuilder('module')
      .select('module.courseId', 'courseId')
      .addSelect('COUNT(*)', 'count')
      .addSelect(
        `COALESCE(SUM(CASE WHEN (module.params->>'daysAllocation') ~ '^[0-9]+(\\.[0-9]+)?$' THEN (module.params->>'daysAllocation')::numeric ELSE 0 END), 0)`,
        'daysAllocationCount',
      )
      .where('module.courseId IN (:...courseIds)', { courseIds })
      .andWhere('module.tenantId = :tenantId', { tenantId })
      .andWhere('module.status != :archivedStatus', {
        archivedStatus: ModuleStatus.ARCHIVED,
      })
      .groupBy('module.courseId')
      .getRawMany<{ courseId: string; count: string; daysAllocationCount: string }>();

    const countMap = new Map(
      counts.map((row) => [
        row.courseId,
        {
          totalModuleCount: Number(row.count),
          daysAllocationCount: Number(row.daysAllocationCount),
        },
      ]),
    );

    return courses.map((course) => {
      const stats = countMap.get(course.courseId);
      return {
        ...course,
        totalModuleCount: stats?.totalModuleCount || 0,
        daysAllocationCount: stats?.daysAllocationCount || 0,
      };
    });
  }

  /**
   * hasEnroll=true: adds totalModuleCount, completedModuleCount, the latest course tracking and
   * the latest published enrollment to a page of courses with ONE query (correlated subqueries,
   * one row per course - no per-course queries, no duplicates).
   */
  private async attachUserCourseProgress(
    courses: Course[],
    userId: string,
    tenantId: string,
    organisationId: string,
  ): Promise<UserEnrolledCourseDto[]> {
    if (courses.length === 0) return courses;

    const rows = await this.courseRepository
      .createQueryBuilder('course')
      .select('course.courseId', 'courseId')
      // Same module scope as courses/search moduleCount: non-archived modules of the course
      .addSelect(
        '(SELECT COUNT(*) FROM "modules" "module" ' +
        'WHERE "module"."courseId" = "course"."courseId" ' +
        'AND "module"."tenantId" = :tenantId ' +
        'AND "module"."status" != :archivedModuleStatus)',
        'totalModuleCount',
      )
      .addSelect(
        '(SELECT COALESCE(SUM(CASE WHEN ("module"."params"->>\'daysAllocation\') ~ \'^[0-9]+(\\.[0-9]+)?$\' THEN ("module"."params"->>\'daysAllocation\')::numeric ELSE 0 END), 0) FROM "modules" "module" ' +
        'WHERE "module"."courseId" = "course"."courseId" ' +
        'AND "module"."tenantId" = :tenantId ' +
        'AND "module"."status" != :archivedModuleStatus)',
        'daysAllocationCount',
      )
      // module_track has no courseId; the course comes from the tracked module
      .addSelect(
        '(SELECT COUNT(DISTINCT "moduleTrack"."moduleId") FROM "module_track" "moduleTrack" ' +
        'INNER JOIN "modules" "trackedModule" ON "trackedModule"."moduleId" = "moduleTrack"."moduleId" ' +
        'WHERE "trackedModule"."courseId" = "course"."courseId" ' +
        'AND "trackedModule"."status" != :archivedModuleStatus ' +
        'AND "moduleTrack"."userId" = :userId ' +
        'AND "moduleTrack"."tenantId" = :tenantId ' +
        'AND "moduleTrack"."organisationId" = :organisationId ' +
        'AND "moduleTrack"."status" = :completedModuleStatus)',
        'completedModuleCount',
      )
      // course_track is unique per (userId, courseId); LIMIT 1 still guarantees a single row
      .addSelect(
        '(SELECT row_to_json("courseTrack") FROM "course_track" "courseTrack" ' +
        'WHERE "courseTrack"."courseId" = "course"."courseId" ' +
        'AND "courseTrack"."userId" = :userId ' +
        'AND "courseTrack"."tenantId" = :tenantId ' +
        'AND "courseTrack"."organisationId" = :organisationId ' +
        'ORDER BY "courseTrack"."lastAccessedDate" DESC NULLS LAST LIMIT 1)',
        'courseTracking',
      )
      // A user can have several enrollment rows per course; take the latest published one
      .addSelect(
        '(SELECT row_to_json("enrollment") FROM "user_enrollments" "enrollment" ' +
        'WHERE "enrollment"."courseId" = "course"."courseId" ' +
        'AND "enrollment"."userId" = :userId ' +
        'AND "enrollment"."tenantId" = :tenantId ' +
        'AND "enrollment"."organisationId" = :organisationId ' +
        'AND "enrollment"."status" = :publishedEnrollmentStatus ' +
        'ORDER BY "enrollment"."enrolledAt" DESC LIMIT 1)',
        'enrollment',
      )
      .where('course.courseId IN (:...courseIds)', {
        courseIds: courses.map((c) => c.courseId),
      })
      .setParameters({
        userId,
        tenantId,
        organisationId,
        archivedModuleStatus: ModuleStatus.ARCHIVED,
        completedModuleStatus: ModuleTrackStatus.COMPLETED,
        publishedEnrollmentStatus: EnrollmentStatus.PUBLISHED,
      })
      .getRawMany<{
        courseId: string;
        totalModuleCount: string;
        daysAllocationCount: string;
        completedModuleCount: string;
        courseTracking: CourseTrack | null;
        enrollment: UserEnrollment | null;
      }>();

    // Attach each course's row (course metadata itself comes from the per-course cache above)
    const progressByCourseId = new Map(rows.map((row) => [row.courseId, row]));
    return courses.map((course) => {
      const progress = progressByCourseId.get(course.courseId);
      return {
        ...course,
        totalModuleCount: Number(progress?.totalModuleCount ?? 0),
        daysAllocationCount: Number(progress?.daysAllocationCount ?? 0),
        completedModuleCount: Number(progress?.completedModuleCount ?? 0),
        courseTracking: progress?.courseTracking ?? null,
        // No course_track row yet means the user has not started the course
        trackingStatus:
          progress?.courseTracking?.status ?? TrackingStatus.NOT_STARTED,
        enrollment: progress?.enrollment ?? null,
      };
    });
  }

  /**
   * Update an enrollment
   */
  async update(
    enrollmentId: string,
    updateEnrollmentDto: UpdateEnrollmentDto,
    tenantId: string,
    organisationId: string,
  ): Promise<UserEnrollment> {
    try {
      const enrollment = await this.findOne(
        enrollmentId,
        tenantId,
        organisationId,
      );

      // Update enrollment fields
      Object.assign(enrollment, updateEnrollmentDto);

      // Save updated enrollment
      const updatedEnrollment =
        await this.userEnrollmentRepository.save(enrollment);

      // Update cache and invalidate related caches (best-effort, non-blocking)
      // Cache operations are wrapped to prevent Redis errors from breaking requests
      const enrollmentKey = this.cacheConfig.getEnrollmentKey(
        updatedEnrollment.userId,
        updatedEnrollment.courseId,
        tenantId,
        organisationId,
      );
      try {
        await Promise.all([
          this.cacheService.invalidateEnrollment(
            updatedEnrollment.userId,
            updatedEnrollment.courseId,
            tenantId,
            organisationId,
          ),
          this.cacheService.del(
            this.cacheConfig.getUserEnrollmentKey(
              enrollmentId,
              tenantId,
              organisationId,
            ),
          ),
          this.cacheService.set(
            enrollmentKey,
            updatedEnrollment,
            this.cacheConfig.ENROLLMENT_TTL,
          ),
        ]);
      } catch (cacheError) {
        // Log cache operation failure but don't break the request
        // Cache is an optimization - API should work even if Redis is down
        this.logger.warn(
          `Failed to update enrollment cache: ${cacheError.message}`
        );
      }

      return updatedEnrollment;
    } catch (error) {
      this.logger.error(`Error updating enrollment: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(RESPONSE_MESSAGES.UPDATE_ERROR);
    }
  }

  /**
   * Hard delete enrollment and all related tracking records
   */
  async hardDelete(
    courseId: string,
    userId: string,
    tenantId: string,
    organisationId: string,
  ): Promise<{ success: boolean; message: string }> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Find the enrollment
      const enrollment = await queryRunner.manager.findOne(UserEnrollment, {
        where: {
          courseId,
          userId,
          tenantId,
          organisationId,
        },
      });

      if (!enrollment) {
        throw new NotFoundException(RESPONSE_MESSAGES.ENROLLMENT_NOT_FOUND);
      }

      // Check if user has any lesson attempts for this course
      const lessonAttempts = await queryRunner.manager.find(LessonTrack, {
        where: {
          courseId,
          userId,
          tenantId,
          organisationId,
        },
        select: ['lessonTrackId'],
      });

      if (lessonAttempts.length > 0) {
        throw new BadRequestException(
          RESPONSE_MESSAGES.ERROR.CANNOT_DELETE_ENROLLMENT_WITH_ATTEMPTS,
        );
      }

      // Get all modules for this course to delete module tracking records
      const modules = await queryRunner.manager.find(CourseModule, {
        where: {
          courseId,
          tenantId,
          organisationId,
        },
        select: ['moduleId'],
      });

      if (modules.length > 0) {
        const moduleIds = modules.map((m) => m.moduleId);

        // Delete module tracking records
        await queryRunner.manager.delete(ModuleTrack, {
          userId,
          tenantId,
          organisationId,
          moduleId: In(moduleIds),
        });
      }

      // Delete course tracking record
      await queryRunner.manager.delete(CourseTrack, {
        courseId,
        userId,
        tenantId,
        organisationId,
      });

      // Delete the enrollment
      await queryRunner.manager.delete(UserEnrollment, {
        courseId,
        userId,
        tenantId,
        organisationId,
      });

      // Commit the transaction
      await queryRunner.commitTransaction();

      // Invalidate all related caches
      await Promise.all([
        this.cacheService.del(
          this.cacheConfig.getUserEnrollmentKey(
            enrollment.enrollmentId,
            tenantId,
            organisationId,
          ),
        ),
        this.cacheService.del(
          this.cacheConfig.getEnrollmentKey(
            userId,
            courseId,
            tenantId,
            organisationId,
          ),
        ),
        this.cacheService.invalidateEnrollment(
          userId,
          courseId,
          tenantId,
          organisationId,
        ),
      ]);

      return {
        success: true,
        message: RESPONSE_MESSAGES.ENROLLMENT_DELETED,
      };
    } catch (error) {
      // Rollback the transaction on error
      await queryRunner.rollbackTransaction();

      this.logger.error(`Error hard deleting enrollment: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(RESPONSE_MESSAGES.DELETE_ERROR);
    } finally {
      // Release the query runner
      await queryRunner.release();
    }
  }

  /**
   * Get dashboard metrics for a user
   * @param userId The target user ID
   * @param tenantId Tenant ID for data isolation
   * @param organisationId Organization ID for data isolation
   */
  async dashboardByUserId(
    userId: string,
    tenantId: string,
    organisationId: string,
  ): Promise<DashboardByUserIdResponseDto> {
    this.logger.log(`Fetching dashboard metrics for user: ${userId}`);

    // 1. totalCount: Total count of enrolled courses for the user
    const totalCount = await this.userEnrollmentRepository.count({
      where: {
        userId,
        tenantId,
        organisationId,
        status: EnrollmentStatus.PUBLISHED,
      },
    });

    // 2. courseCompletionCount: Total course tracks with status = completed
    const courseCompletionCount = await this.courseTrackRepository.count({
      where: {
        userId,
        tenantId,
        organisationId,
        status: TrackingStatus.COMPLETED,
      },
    });

    // 3. courseStatusStartedCount: Total course tracks with status = started
    const courseStatusStartedCount = await this.courseTrackRepository.count({
      where: {
        userId,
        tenantId,
        organisationId,
        status: TrackingStatus.STARTED,
      },
    });

    // 4. certificateCount: Total certificates issued (default to 0)
    const certificateCount = await this.courseTrackRepository.count({
      where: {
        userId,
        tenantId,
        organisationId,
        certificateIssued: true,
      },
    });

    // 5. mandatoryDueCount: enrolledBy != userId and course track status != completed (or null)
    const mandatoryDueCount = await this.userEnrollmentRepository
      .createQueryBuilder('enrollment')
      .leftJoin(
        CourseTrack,
        'courseTrack',
        'courseTrack.courseId = enrollment.courseId AND courseTrack.userId = enrollment.userId AND courseTrack.tenantId = enrollment.tenantId AND courseTrack.organisationId = enrollment.organisationId',
      )
      .where('enrollment.userId = :userId', { userId })
      .andWhere('enrollment.tenantId = :tenantId', { tenantId })
      .andWhere('enrollment.organisationId = :organisationId', { organisationId })
      .andWhere('enrollment.status = :enrollmentStatus', {
        enrollmentStatus: EnrollmentStatus.PUBLISHED,
      })
      .andWhere('enrollment.enrolledBy != :userId', { userId })
      .andWhere(
        '(courseTrack.status IS NULL OR courseTrack.status != :completedStatus)',
        { completedStatus: TrackingStatus.COMPLETED },
      )
      .getCount();

    // 6. completedCoursesByCategory: Course count tracking status completed categoryId wise
    const completedCoursesRaw = await this.courseTrackRepository
      .createQueryBuilder('courseTrack')
      .innerJoin(Course, 'course', 'course.courseId = courseTrack.courseId')
      .select('UNNEST(course.categoryIds)', 'categoryId')
      .addSelect('COUNT(DISTINCT courseTrack.courseId)', 'count')
      .where('courseTrack.userId = :userId', { userId })
      .andWhere('courseTrack.tenantId = :tenantId', { tenantId })
      .andWhere('courseTrack.organisationId = :organisationId', { organisationId })
      .andWhere('courseTrack.status = :status', { status: TrackingStatus.COMPLETED })
      .andWhere('course.categoryIds IS NOT NULL')
      .groupBy('UNNEST(course.categoryIds)')
      .getRawMany<{ categoryId: string; count: string }>();

    const completedCoursesByCategory: CategoryCountDto[] = completedCoursesRaw.map(
      (row) => ({
        categoryId: row.categoryId,
        count: Number(row.count || 0),
      }),
    );

    // 7. completedStandaloneLessonsByCategory: Standalone lesson track completed (courseId IS NULL AND moduleId IS NULL) categoryId wise
    const completedStandaloneLessonsRaw = await this.lessonTrackRepository
      .createQueryBuilder('lessonTrack')
      .innerJoin(Lesson, 'lesson', 'lesson.lessonId = lessonTrack.lessonId')
      .select('UNNEST(lesson.categoryIds)', 'categoryId')
      .addSelect('COUNT(DISTINCT lessonTrack.lessonId)', 'count')
      .where('lessonTrack.userId = :userId', { userId })
      .andWhere('lessonTrack.tenantId = :tenantId', { tenantId })
      .andWhere('lessonTrack.organisationId = :organisationId', { organisationId })
      .andWhere('lessonTrack.status = :status', { status: TrackingStatus.COMPLETED })
      .andWhere(
        '(lessonTrack.courseId IS NULL AND (lesson.courseId IS NULL AND lesson.moduleId IS NULL))',
      )
      .andWhere('lesson.categoryIds IS NOT NULL')
      .groupBy('UNNEST(lesson.categoryIds)')
      .getRawMany<{ categoryId: string; count: string }>();

    const completedStandaloneLessonsByCategory: CategoryCountDto[] =
      completedStandaloneLessonsRaw.map((row) => ({
        categoryId: row.categoryId,
        count: Number(row.count || 0),
      }));

    return {
      totalCount: totalCount || 0,
      courseCompletionCount: courseCompletionCount || 0,
      courseStatusStartedCount: courseStatusStartedCount || 0,
      certificateCount: certificateCount || 0,
      mandatoryDueCount: mandatoryDueCount || 0,
      completedCoursesByCategory,
      completedStandaloneLessonsByCategory,
    };
  }

  /**
   * Get coach progress dashboard metrics (Admin App) across all coaches
   * @param tenantId Tenant ID for data isolation
   * @param organisationId Organization ID for data isolation
   * @param authorization Caller's bearer token, forwarded to the user service for coach profiles
   * @param userId Optional coach ID: limits `coaches` to that coach and adds their learning journey
   */
  async getCoachProgressDashboard(
    tenantId: string,
    organisationId: string,
    authorization?: string,
    userId?: string,
  ): Promise<CoachProgressDashboardResponseDto> {
    this.logger.log('Fetching coach progress dashboard metrics');

    // 1. coachesAssigned: distinct users with a published enrollment in a non-archived course
    const coachesAssignedQuery = this.userEnrollmentRepository
      .createQueryBuilder('enrollment')
      .innerJoin(Course, 'course', 'course.courseId = enrollment.courseId')
      .select('COUNT(DISTINCT enrollment.userId)', 'count')
      .where('enrollment.tenantId = :tenantId', { tenantId })
      .andWhere('enrollment.organisationId = :organisationId', {
        organisationId,
      })
      .andWhere('enrollment.status = :enrollmentStatus', {
        enrollmentStatus: EnrollmentStatus.PUBLISHED,
      })
      .andWhere('course.status != :archivedCourseStatus', {
        archivedCourseStatus: CourseStatus.ARCHIVED,
      })
      .getRawOne<{ count: string }>();

    // 2. coursesCompleted: course_track is unique per (userId, courseId)
    const coursesCompletedQuery = this.courseTrackRepository
      .createQueryBuilder('courseTrack')
      .innerJoin(Course, 'course', 'course.courseId = courseTrack.courseId')
      .where('courseTrack.tenantId = :tenantId', { tenantId })
      .andWhere('courseTrack.organisationId = :organisationId', {
        organisationId,
      })
      .andWhere('courseTrack.status = :completedStatus', {
        completedStatus: TrackingStatus.COMPLETED,
      })
      .andWhere('course.status != :archivedCourseStatus', {
        archivedCourseStatus: CourseStatus.ARCHIVED,
      })
      .getCount();

    // 3. modulesCompleted: one per (userId, moduleId) for non-archived modules
    const modulesCompletedQuery = this.moduleTrackRepository
      .createQueryBuilder('moduleTrack')
      .innerJoin(
        CourseModule,
        'module',
        'module.moduleId = moduleTrack.moduleId',
      )
      .select(
        "COUNT(DISTINCT CONCAT(moduleTrack.userId, ':', moduleTrack.moduleId))",
        'count',
      )
      .where('moduleTrack.tenantId = :tenantId', { tenantId })
      .andWhere('moduleTrack.organisationId = :organisationId', {
        organisationId,
      })
      .andWhere('moduleTrack.status = :completedStatus', {
        completedStatus: ModuleTrackStatus.COMPLETED,
      })
      .andWhere('module.status != :archivedModuleStatus', {
        archivedModuleStatus: ModuleStatus.ARCHIVED,
      })
      .getRawOne<{ count: string }>();

    // Completed lesson tracks (course and standalone lessons); a lesson can have several
    // attempts, so completions are counted once per (userId, lessonId)
    const completedLessonsQuery = () =>
      this.lessonTrackRepository
        .createQueryBuilder('lessonTrack')
        .innerJoin(Lesson, 'lesson', 'lesson.lessonId = lessonTrack.lessonId')
        .where('lessonTrack.tenantId = :tenantId', { tenantId })
        .andWhere('lessonTrack.organisationId = :organisationId', {
          organisationId,
        })
        .andWhere('lessonTrack.status = :completedStatus', {
          completedStatus: TrackingStatus.COMPLETED,
        })
        .andWhere('lesson.status != :archivedLessonStatus', {
          archivedLessonStatus: LessonStatus.ARCHIVED,
        });
    const completedLessonKey =
      "COUNT(DISTINCT CONCAT(lessonTrack.userId, ':', lessonTrack.lessonId))";

    // 4. contentCompleted
    const contentCompletedQuery = completedLessonsQuery()
      .select(completedLessonKey, 'count')
      .getRawOne<{ count: string }>();

    // 5. completedByPathway: lessons carry their own categoryIds; legacy lessons without
    // categories fall back to their course's categoryIds. UNNEST runs in a subquery since
    // set-returning functions are not allowed in GROUP BY.
    const completedLessonCategories = completedLessonsQuery()
      .leftJoin(Course, 'course', 'course.courseId = lesson.courseId')
      .select('lessonTrack.userId', 'userId')
      .addSelect('lessonTrack.lessonId', 'lessonId')
      .addSelect(
        'UNNEST(COALESCE(lesson.categoryIds, course.categoryIds))',
        'categoryId',
      );
    const completedByPathwayQuery = this.dataSource
      .createQueryBuilder()
      .select('"completed"."categoryId"', 'categoryId')
      .addSelect(
        'COUNT(DISTINCT CONCAT("completed"."userId", \':\', "completed"."lessonId"))',
        'count',
      )
      .from(`(${completedLessonCategories.getQuery()})`, 'completed')
      .setParameters(completedLessonCategories.getParameters())
      .groupBy('"completed"."categoryId"')
      .getRawMany<{ categoryId: string; count: string }>();

    // 6. certificatesEarned: issued certificates for assigned (published enrollment) courses
    const certificatesEarnedQuery = this.coachCertificatesQuery(
      tenantId,
      organisationId,
    )
      .select('COUNT(DISTINCT certificate.usercertificateId)', 'count')
      .getRawOne<{ count: string }>();

    const [
      coachesAssignedRaw,
      coursesCompleted,
      modulesCompletedRaw,
      contentCompletedRaw,
      completedByPathwayRaw,
      certificatesEarnedRaw,
      coaches,
    ] = await Promise.all([
      coachesAssignedQuery,
      coursesCompletedQuery,
      modulesCompletedQuery,
      contentCompletedQuery,
      completedByPathwayQuery,
      certificatesEarnedQuery,
      this.getCoachProgressRows(
        tenantId,
        organisationId,
        authorization,
        userId,
      ),
    ]);

    const contentCompleted = Number(contentCompletedRaw?.count || 0);

    const completedByPathway: PathwayCompletionDto[] = completedByPathwayRaw
      .filter((row) => row.categoryId)
      .map((row) => {
        const completedCount = Number(row.count || 0);
        return {
          categoryId: row.categoryId,
          completedCount,
          percentage: contentCompleted
            ? Math.round((completedCount / contentCompleted) * 10000) / 100
            : 0,
        };
      });

    return {
      coachesAssigned: Number(coachesAssignedRaw?.count || 0),
      coursesCompleted: coursesCompleted || 0,
      modulesCompleted: Number(modulesCompletedRaw?.count || 0),
      contentCompleted,
      completedByPathway,
      certificatesEarned: Number(certificatesEarnedRaw?.count || 0),
      coaches,
    };
  }

  /**
   * Issued course certificates of coaches, limited to courses they hold a published
   * enrollment in (same scope as coachesAssigned). user_certificates.tenantId/userId are
   * uuid columns while enrollments use varchar, so they are compared as text.
   */
  private coachCertificatesQuery(
    tenantId: string,
    organisationId: string,
    userId?: string,
  ) {
    const query = this.userCertificateRepository
      .createQueryBuilder('certificate')
      .innerJoin(
        UserEnrollment,
        'enrollment',
        'enrollment.userId = CAST(certificate.userId AS text) AND CAST(enrollment.courseId AS text) = certificate.contextId',
      )
      .innerJoin(Course, 'course', 'course.courseId = enrollment.courseId')
      .where('CAST(certificate.tenantId AS text) = :tenantId', { tenantId })
      .andWhere('certificate.contextType = :contextType', {
        contextType: 'courses',
      })
      .andWhere('certificate.status = :certificateStatus', {
        certificateStatus: 'issued',
      })
      .andWhere('enrollment.tenantId = :tenantId', { tenantId })
      .andWhere('enrollment.organisationId = :organisationId', {
        organisationId,
      })
      .andWhere('enrollment.status = :enrollmentStatus', {
        enrollmentStatus: EnrollmentStatus.PUBLISHED,
      })
      .andWhere('course.status != :archivedCourseStatus', {
        archivedCourseStatus: CourseStatus.ARCHIVED,
      });
    if (userId) {
      query.andWhere('enrollment.userId = :userId', { userId });
    }
    return query;
  }

  /**
   * Per-coach rows for the Coach Progress Dashboard table: every coach with a published
   * enrollment in a non-archived course (i.e. assigned from the course list), with
   * province/site from the user service, pathway IDs, progress and certificates.
   */
  private async getCoachProgressRows(
    tenantId: string,
    organisationId: string,
    authorization?: string,
    userId?: string,
  ): Promise<CoachProgressDto[]> {
    const enrollmentsQuery = this.userEnrollmentRepository
      .createQueryBuilder('enrollment')
      .innerJoin(Course, 'course', 'course.courseId = enrollment.courseId')
      .leftJoin(
        CourseTrack,
        'courseTrack',
        'courseTrack.userId = enrollment.userId AND courseTrack.courseId = enrollment.courseId AND courseTrack.tenantId = enrollment.tenantId AND courseTrack.organisationId = enrollment.organisationId',
      )
      .select('enrollment.userId', 'userId')
      .addSelect('enrollment.courseId', 'courseId')
      .addSelect(
        'COALESCE(enrollment.enrolledOnTime, enrollment.enrolledAt)',
        'enrolledOn',
      )
      .addSelect('course.title', 'courseTitle')
      .addSelect('course.categoryIds', 'categoryIds')
      .addSelect('courseTrack.status', 'trackStatus')
      .addSelect('courseTrack.completedLessons', 'completedLessons')
      .addSelect('courseTrack.noOfLessons', 'noOfLessons')
      .addSelect('courseTrack.endDatetime', 'completedOn')
      .where('enrollment.tenantId = :tenantId', { tenantId })
      .andWhere('enrollment.organisationId = :organisationId', {
        organisationId,
      })
      .andWhere('enrollment.status = :enrollmentStatus', {
        enrollmentStatus: EnrollmentStatus.PUBLISHED,
      })
      .andWhere('course.status != :archivedCourseStatus', {
        archivedCourseStatus: CourseStatus.ARCHIVED,
      });
    if (userId) {
      enrollmentsQuery.andWhere('enrollment.userId = :userId', { userId });
    }

    const certificatesQuery = this.coachCertificatesQuery(
      tenantId,
      organisationId,
      userId,
    )
      .select('certificate.usercertificateId', 'usercertificateId')
      .addSelect('CAST(certificate.userId AS text)', 'userId')
      .addSelect('certificate.contextId', 'courseId')
      .addSelect('course.title', 'courseTitle')
      .addSelect('certificate.certificate_type', 'certificateType')
      .addSelect('certificate.issuedOn', 'issuedOn')
      .addSelect('certificate.certificateUrl', 'certificateUrl')
      .orderBy('certificate.issuedOn', 'ASC');

    const [enrollmentRows, certificateRows] = await Promise.all([
      enrollmentsQuery.getRawMany<{
        userId: string;
        courseId: string;
        enrolledOn: Date | null;
        courseTitle: string;
        categoryIds: string[] | null;
        trackStatus: TrackingStatus | null;
        completedLessons: number | null;
        noOfLessons: number | null;
        completedOn: Date | null;
      }>(),
      certificatesQuery.getRawMany<CoachCertificateDto & { userId: string }>(),
    ]);

    const coaches = new Map<
      string,
      {
        pathwayIds: Set<string>;
        progressTotal: number;
        totalCourses: number;
        completedCourses: number;
        certificates: CoachCertificateDto[];
      }
    >();
    const getCoach = (id: string) => {
      let coach = coaches.get(id);
      if (!coach) {
        coach = {
          pathwayIds: new Set(),
          progressTotal: 0,
          totalCourses: 0,
          completedCourses: 0,
          certificates: [],
        };
        coaches.set(id, coach);
      }
      return coach;
    };

    for (const row of enrollmentRows) {
      const coach = getCoach(row.userId);
      (row.categoryIds || []).forEach((id) => id && coach.pathwayIds.add(id));
      coach.totalCourses++;
      // Course progress as in the user journey: completedLessons / noOfLessons from course_track
      const isCompleted = row.trackStatus === TrackingStatus.COMPLETED;
      const noOfLessons = Number(row.noOfLessons || 0);
      const progress = isCompleted
        ? 100
        : noOfLessons > 0
          ? Math.min(
              100,
              (Number(row.completedLessons || 0) / noOfLessons) * 100,
            )
          : 0;
      coach.progressTotal += progress;
      if (isCompleted) coach.completedCourses++;
    }

    for (const { userId: coachId, ...certificate } of certificateRows) {
      coaches.get(coachId)?.certificates.push(certificate);
    }

    const profiles = await this.fetchCoachProfiles(
      Array.from(coaches.keys()),
      tenantId,
      authorization,
    );

    const journey = userId
      ? await this.getCoachJourney(
          userId,
          tenantId,
          organisationId,
          enrollmentRows,
          certificateRows,
        )
      : undefined;

    return Array.from(coaches, ([coachId, coach]) => {
      const profile = profiles.get(coachId);
      return {
        userId: coachId,
        coachName: profile?.coachName ?? null,
        province: profile?.province ?? null,
        provinceId: profile?.provinceId ?? null,
        site: profile?.site ?? null,
        siteId: profile?.siteId ?? null,
        pathwayIds: Array.from(coach.pathwayIds),
        totalCourses: coach.totalCourses,
        completedCourses: coach.completedCourses,
        pathwayProgress: coach.totalCourses
          ? Math.round(coach.progressTotal / coach.totalCourses)
          : 0,
        certificatesEarned: coach.certificates.length,
        certificates: coach.certificates,
        ...(journey && { journey }),
      };
    }).sort((a, b) => (a.coachName || '').localeCompare(b.coachName || ''));
  }

  /**
   * Learning journey timeline of one coach: course enrollments, completed lessons,
   * completed courses and issued certificates, oldest first.
   */
  private async getCoachJourney(
    userId: string,
    tenantId: string,
    organisationId: string,
    enrollmentRows: {
      courseId: string;
      courseTitle: string;
      enrolledOn: Date | null;
      trackStatus: TrackingStatus | null;
      completedOn: Date | null;
    }[],
    certificateRows: CoachCertificateDto[],
  ): Promise<CoachJourneyItemDto[]> {
    const courseIds = enrollmentRows.map((row) => row.courseId);
    const journey: CoachJourneyItemDto[] = [];

    enrollmentRows.forEach((row) => {
      journey.push({
        type: 'enrolled',
        title: `Enrolled in ${row.courseTitle}`,
        date: row.enrolledOn,
        courseId: row.courseId,
      });
      if (row.trackStatus === TrackingStatus.COMPLETED) {
        journey.push({
          type: 'course_completed',
          title: `Completed: ${row.courseTitle}`,
          date: row.completedOn,
          courseId: row.courseId,
        });
      }
    });

    if (courseIds.length) {
      // A lesson can have several attempts; the first completion is the milestone
      const completedLessons = await this.lessonTrackRepository
        .createQueryBuilder('lessonTrack')
        .innerJoin(Lesson, 'lesson', 'lesson.lessonId = lessonTrack.lessonId')
        .select('lessonTrack.lessonId', 'lessonId')
        .addSelect('lessonTrack.courseId', 'courseId')
        .addSelect('lesson.title', 'title')
        .addSelect('lesson.format', 'format')
        .addSelect('lesson.subFormat', 'subFormat')
        .addSelect(
          'MIN(COALESCE(lessonTrack.endDatetime, lessonTrack.updatedAt))',
          'completedOn',
        )
        .where('lessonTrack.userId = :userId', { userId })
        .andWhere('lessonTrack.tenantId = :tenantId', { tenantId })
        .andWhere('lessonTrack.organisationId = :organisationId', {
          organisationId,
        })
        .andWhere('lessonTrack.courseId IN (:...courseIds)', { courseIds })
        .andWhere('lessonTrack.status = :completedStatus', {
          completedStatus: TrackingStatus.COMPLETED,
        })
        .andWhere('lesson.status != :archivedLessonStatus', {
          archivedLessonStatus: LessonStatus.ARCHIVED,
        })
        .groupBy('lessonTrack.lessonId')
        .addGroupBy('lessonTrack.courseId')
        .addGroupBy('lesson.title')
        .addGroupBy('lesson.format')
        .addGroupBy('lesson.subFormat')
        .getRawMany<{
          lessonId: string;
          courseId: string;
          title: string;
          format: string;
          subFormat: string;
          completedOn: Date | null;
        }>();

      completedLessons.forEach((lesson) =>
        journey.push({
          type: 'lesson_completed',
          title: `Completed: ${lesson.title}`,
          date: lesson.completedOn,
          courseId: lesson.courseId,
          lessonId: lesson.lessonId,
          format: lesson.format,
          subFormat: lesson.subFormat,
        }),
      );
    }

    certificateRows.forEach((certificate) =>
      journey.push({
        type: 'certificate_issued',
        title: `Earned ${certificate.certificateType || 'certificate'}: ${certificate.courseTitle}`,
        date: certificate.issuedOn,
        courseId: certificate.courseId,
        certificateType: certificate.certificateType,
      }),
    );

    const time = (date: Date | null) =>
      date ? new Date(date).getTime() : Number.MAX_SAFE_INTEGER;
    return journey.sort((a, b) => time(a.date) - time(b.date));
  }

  /**
   * Coach name/province/site from the user service, using the same account search as the
   * course list's coach assignment (type/role org_admin). Profiles are optional: on failure
   * the rows are still returned with null name/province/site.
   */
  private async fetchCoachProfiles(
    userIds: string[],
    tenantId: string,
    authorization?: string,
  ): Promise<
    Map<
      string,
      {
        coachName: string | null;
        province: string | null;
        provinceId: string | null;
        site: string | null;
        siteId: string | null;
      }
    >
  > {
    const profiles = new Map();
    const userServiceUrl = this.configService.get<string>(
      'USER_SERVICE_URL',
      '',
    );
    if (!userIds.length || !userServiceUrl || !authorization) {
      if (userIds.length) {
        this.logger.warn(
          'Coach profiles skipped: USER_SERVICE_URL or authorization missing',
        );
      }
      return profiles;
    }

    const PAGE_SIZE = 100;
    const MAX_PAGES = 50;
    const pending = new Set(userIds);
    try {
      for (let page = 1; page <= MAX_PAGES && pending.size; page++) {
        const { data } = await axios.post(
          `${userServiceUrl}/account/search`,
          { user_ids: userIds },
          {
            params: {
              tenant_code: tenantId,
              type: 'org_admin',
              role: 'org_admin',
              page,
              limit: PAGE_SIZE,
            },
            headers: {
              'x-auth-token': authorization.replace(/^Bearer\s+/i, ''),
              'x-tenant-code': tenantId,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          },
        );
        const users: any[] = Array.isArray(data?.result?.data)
          ? data.result.data
          : [];
        users.forEach((user) => {
          const id = String(user.id ?? '');
          if (!pending.has(id)) return;
          pending.delete(id);
          profiles.set(id, {
            coachName:
              user.name ||
              [user.firstName, user.lastName].filter(Boolean).join(' ') ||
              user.username ||
              null,
            province: user.province?.label ?? null,
            provinceId: user.province?.value ?? null,
            site: user.site?.label ?? null,
            siteId: user.site?.value ?? null,
          });
        });
        const total = Number(data?.result?.count || 0);
        if (users.length < PAGE_SIZE || page * PAGE_SIZE >= total) break;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to fetch coach profiles from user service: ${error?.response?.status ?? ''} ${error?.message}`,
      );
    }
    return profiles;
  }
}
