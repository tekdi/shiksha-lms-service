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
  ObjectLiteral,
  SelectQueryBuilder,
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
import { DashboardByUserIdResponseDto } from './dto/dashboard-by-user-id.dto';
import {
  CategoryProgressDto,
  CoachProgressDashboardResponseDto,
} from './dto/coach-progress-dashboard.dto';
import { UserCourseCertificate } from '../certificate/entities/user_certificates';

// Category reported for coach dashboard courses/lessons that have no category assigned
const UNCATEGORIZED_CATEGORY_ID = 'other';

// A categoryIds column without blank entries, NULL when nothing is left
const assignedCategoryIds = (column: string) =>
  `NULLIF(ARRAY_REMOVE(ARRAY_REMOVE(${column}, NULL), ''), '{}')`;

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

    // The user's courses as users-courses (hasEnroll=true) lists them: published enrollments in
    // published courses, with the user's course track when there is one
    const assignedCoursesQuery = () =>
      this.userEnrollmentRepository
        .createQueryBuilder('enrollment')
        .innerJoin(Course, 'course', 'course.courseId = enrollment.courseId')
        .leftJoin(
          CourseTrack,
          'courseTrack',
          'courseTrack.courseId = enrollment.courseId AND courseTrack.userId = enrollment.userId AND courseTrack.tenantId = enrollment.tenantId AND courseTrack.organisationId = enrollment.organisationId',
        )
        .where('enrollment.userId = :userId', { userId })
        .andWhere('enrollment.tenantId = :tenantId', { tenantId })
        .andWhere('enrollment.organisationId = :organisationId', {
          organisationId,
        })
        .andWhere('enrollment.status = :enrollmentStatus', {
          enrollmentStatus: EnrollmentStatus.PUBLISHED,
        })
        .andWhere('course.status = :coursePublishedStatus', {
          coursePublishedStatus: CourseStatus.PUBLISHED,
        });

    // 1-3. totalCount (assigned courses), courseCompletionCount (completed) and
    // courseStatusStartedCount (in progress: incomplete, as users-courses trackingStatus=incomplete)
    const courseCounts = await assignedCoursesQuery()
      .select('COUNT(DISTINCT enrollment.courseId)', 'total')
      .addSelect(
        'COUNT(DISTINCT enrollment.courseId) FILTER (WHERE courseTrack.status = :completedStatus)',
        'completed',
      )
      .addSelect(
        'COUNT(DISTINCT enrollment.courseId) FILTER (WHERE courseTrack.status = :inProgressStatus)',
        'inProgress',
      )
      .setParameters({
        completedStatus: TrackingStatus.COMPLETED,
        inProgressStatus: TrackingStatus.INCOMPLETE,
      })
      .getRawOne<{ total: string; completed: string; inProgress: string }>();

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

    // 6. courses per category: the same assigned courses, so the totals add up to totalCount
    // and the completed counts to courseCompletionCount
    const courseRows = assignedCoursesQuery()
      .select('enrollment.userId', 'userId')
      .addSelect('enrollment.courseId', 'itemId')
      .addSelect('courseTrack.status', 'status')
      .addSelect(
        `UNNEST(COALESCE(${assignedCategoryIds('course.categoryIds')}, ARRAY['${UNCATEGORIZED_CATEGORY_ID}']::varchar[]))`,
        'categoryId',
      );

    // 7. lessons per category, as the lessons list (isStandalone=true, hasTrack=true) shows them:
    // standalone lessons (no course) the user has tracked, with the status of the user's most
    // recently updated attempt
    const lessonRows = this.lessonRepository
      .createQueryBuilder('lesson')
      .innerJoin(
        LessonTrack,
        'lessonTrack',
        `lessonTrack.lessonTrackId = (
          SELECT lt."lessontrackid" FROM lesson_track lt
          WHERE lt."lessonId" = lesson."lessonId" AND lt."userId" = :userId
          ORDER BY lt."updatedAt" DESC
          LIMIT 1
        )`,
        { userId },
      )
      .select('lessonTrack.userId', 'userId')
      .addSelect('lesson.lessonId', 'itemId')
      .addSelect('lessonTrack.status', 'status')
      .addSelect(
        `UNNEST(COALESCE(${assignedCategoryIds('lesson.categoryIds')}, ARRAY['${UNCATEGORIZED_CATEGORY_ID}']::varchar[]))`,
        'categoryId',
      )
      .where('lesson.tenantId = :tenantId', { tenantId })
      .andWhere('lesson.organisationId = :organisationId', { organisationId })
      .andWhere('lesson.courseId IS NULL')
      .andWhere('lesson.status != :archivedLessonStatus', {
        archivedLessonStatus: LessonStatus.ARCHIVED,
      });

    const [courses, lessons] = await Promise.all([
      this.categoryProgressQuery(courseRows),
      this.categoryProgressQuery(lessonRows),
    ]);

    return {
      totalCount: Number(courseCounts?.total || 0),
      courseCompletionCount: Number(courseCounts?.completed || 0),
      courseStatusStartedCount: Number(courseCounts?.inProgress || 0),
      certificateCount: certificateCount || 0,
      mandatoryDueCount: mandatoryDueCount || 0,
      courses,
      lessons,
    };
  }

  /**
   * Get coach progress dashboard metrics (Admin App) across all coaches
   * @param tenantId Tenant ID for data isolation
   * @param organisationId Organization ID for data isolation
   * @param userIds Optional user IDs: every metric is limited to these users; omitted or
   * empty returns overall statistics
   */
  async getCoachProgressDashboard(
    tenantId: string,
    organisationId: string,
    userIds?: string[],
  ): Promise<CoachProgressDashboardResponseDto> {
    this.logger.log('Fetching coach progress dashboard metrics');

    const users = userIds?.length ? [...new Set(userIds)] : undefined;
    const forUsers = <T extends ObjectLiteral>(
      query: SelectQueryBuilder<T>,
      userIdColumn: string,
    ) =>
      users
        ? query.andWhere(`${userIdColumn} IN (:...userIds)`, { userIds: users })
        : query;

    // 1. coachesAssigned: distinct users with a published enrollment in a non-archived course
    const coachesAssignedQuery = forUsers(
      this.userEnrollmentRepository
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
        }),
      'enrollment.userId',
    ).getRawOne<{ count: string }>();

    // 2. coursesCompleted: course_track is unique per (userId, courseId)
    const coursesCompletedQuery = forUsers(
      this.courseTrackRepository
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
        }),
      'courseTrack.userId',
    ).getCount();

    // 3. modulesCompleted: one per (userId, moduleId) for non-archived modules
    const modulesCompletedQuery = forUsers(
      this.moduleTrackRepository
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
        }),
      'moduleTrack.userId',
    ).getRawOne<{ count: string }>();

    // 4. contentCompleted: completed lessons (course and standalone) of non-archived lessons;
    // a lesson can have several attempts, so it is counted once per (userId, lessonId)
    const contentCompletedQuery = forUsers(
      this.lessonTrackRepository
        .createQueryBuilder('lessonTrack')
        .innerJoin(Lesson, 'lesson', 'lesson.lessonId = lessonTrack.lessonId')
        .select(
          "COUNT(DISTINCT CONCAT(lessonTrack.userId, ':', lessonTrack.lessonId))",
          'count',
        )
        .where('lessonTrack.tenantId = :tenantId', { tenantId })
        .andWhere('lessonTrack.organisationId = :organisationId', {
          organisationId,
        })
        .andWhere('lessonTrack.status = :completedStatus', {
          completedStatus: TrackingStatus.COMPLETED,
        })
        .andWhere('lesson.status != :archivedLessonStatus', {
          archivedLessonStatus: LessonStatus.ARCHIVED,
        }),
      'lessonTrack.userId',
    ).getRawOne<{ count: string }>();

    // 5. certificatesEarned: issued certificates for assigned (published enrollment) courses
    const certificatesEarnedQuery = forUsers(
      this.coachCertificatesQuery(tenantId, organisationId),
      'enrollment.userId',
    )
      .select('COUNT(DISTINCT certificate.usercertificateId)', 'count')
      .getRawOne<{ count: string }>();

    const [
      coachesAssignedRaw,
      coursesCompleted,
      modulesCompletedRaw,
      contentCompletedRaw,
      certificatesEarnedRaw,
      { courses, lessons },
    ] = await Promise.all([
      coachesAssignedQuery,
      coursesCompletedQuery,
      modulesCompletedQuery,
      contentCompletedQuery,
      certificatesEarnedQuery,
      // 6./7. courses and lessons per category
      this.getCategoryProgress(tenantId, organisationId, users),
    ]);

    return {
      coachesAssigned: Number(coachesAssignedRaw?.count || 0),
      coursesCompleted: coursesCompleted || 0,
      modulesCompleted: Number(modulesCompletedRaw?.count || 0),
      contentCompleted: Number(contentCompletedRaw?.count || 0),
      certificatesEarned: Number(certificatesEarnedRaw?.count || 0),
      courses,
      lessons,
    };
  }

  /**
   * Course and lesson tracking per category: completed vs tracked (userId, item) pairs.
   * Courses use courses.categoryIds; lessons use their own categoryIds, falling back to
   * their course's, and items without a category are grouped as "other". Archived courses
   * and lessons are excluded; userIds (when non-empty) limits the users counted.
   */
  private async getCategoryProgress(
    tenantId: string,
    organisationId: string,
    userIds?: string[],
  ): Promise<{
    courses: CategoryProgressDto[];
    lessons: CategoryProgressDto[];
  }> {
    const forUsers = <T extends ObjectLiteral>(
      query: SelectQueryBuilder<T>,
      userIdColumn: string,
    ) =>
      userIds?.length
        ? query.andWhere(`${userIdColumn} IN (:...userIds)`, { userIds })
        : query;

    const courseRows = forUsers(
      this.courseTrackRepository
        .createQueryBuilder('courseTrack')
        .innerJoin(Course, 'course', 'course.courseId = courseTrack.courseId')
        .select('courseTrack.userId', 'userId')
        .addSelect('courseTrack.courseId', 'itemId')
        .addSelect('courseTrack.status', 'status')
        .addSelect(
          `UNNEST(COALESCE(${assignedCategoryIds('course.categoryIds')}, ARRAY['${UNCATEGORIZED_CATEGORY_ID}']::varchar[]))`,
          'categoryId',
        )
        .where('courseTrack.tenantId = :tenantId', { tenantId })
        .andWhere('courseTrack.organisationId = :organisationId', {
          organisationId,
        })
        .andWhere('course.status != :archivedCourseStatus', {
          archivedCourseStatus: CourseStatus.ARCHIVED,
        }),
      'courseTrack.userId',
    );

    const lessonRows = forUsers(
      this.lessonTrackRepository
        .createQueryBuilder('lessonTrack')
        .innerJoin(Lesson, 'lesson', 'lesson.lessonId = lessonTrack.lessonId')
        .leftJoin(Course, 'course', 'course.courseId = lesson.courseId')
        .select('lessonTrack.userId', 'userId')
        .addSelect('lessonTrack.lessonId', 'itemId')
        .addSelect('lessonTrack.status', 'status')
        .addSelect(
          `UNNEST(COALESCE(${assignedCategoryIds('lesson.categoryIds')}, ${assignedCategoryIds('course.categoryIds')}, ARRAY['${UNCATEGORIZED_CATEGORY_ID}']::varchar[]))`,
          'categoryId',
        )
        .where('lessonTrack.tenantId = :tenantId', { tenantId })
        .andWhere('lessonTrack.organisationId = :organisationId', {
          organisationId,
        })
        .andWhere('lesson.status != :archivedLessonStatus', {
          archivedLessonStatus: LessonStatus.ARCHIVED,
        }),
      'lessonTrack.userId',
    );

    const [courses, lessons] = await Promise.all([
      this.categoryProgressQuery(courseRows),
      this.categoryProgressQuery(lessonRows),
    ]);
    return { courses, lessons };
  }

  /**
   * Completed vs tracked (userId, itemId) pairs per category. `trackedItems` selects one row
   * per tracking record and category (userId, itemId, status, categoryId); categories are
   * unnested there because set-returning functions are not allowed in GROUP BY. Pairs are
   * counted distinctly, so repeated attempts or a categoryId listed twice count once, while
   * an item with several categories counts towards each of them.
   */
  private async categoryProgressQuery<T extends ObjectLiteral>(
    trackedItems: SelectQueryBuilder<T>,
  ): Promise<CategoryProgressDto[]> {
    const pair = 'CONCAT("tracked"."userId", \':\', "tracked"."itemId")';
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('"tracked"."categoryId"', 'categoryId')
      .addSelect(
        `COUNT(DISTINCT ${pair}) FILTER (WHERE "tracked"."status" = :categoryCompletedStatus)`,
        'completedCount',
      )
      .addSelect(`COUNT(DISTINCT ${pair})`, 'totalCount')
      .from(`(${trackedItems.getQuery()})`, 'tracked')
      .setParameters({
        ...trackedItems.getParameters(),
        categoryCompletedStatus: TrackingStatus.COMPLETED,
      })
      .groupBy('"tracked"."categoryId"')
      .orderBy('"tracked"."categoryId"')
      .getRawMany<{
        categoryId: string;
        completedCount: string;
        totalCount: string;
      }>();
    return rows
      .map((row) => ({
        categoryId: row.categoryId,
        completedCount: Number(row.completedCount || 0),
        totalCount: Number(row.totalCount || 0),
      }))
      .sort(
        (a, b) =>
          Number(a.categoryId === UNCATEGORIZED_CATEGORY_ID) -
          Number(b.categoryId === UNCATEGORIZED_CATEGORY_ID),
      );
  }

  /**
   * Issued course certificates of coaches, limited to courses they hold a published
   * enrollment in (same scope as coachesAssigned). user_certificates.tenantId/userId are
   * uuid columns while enrollments use varchar, so they are compared as text.
   */
  private coachCertificatesQuery(
    tenantId: string,
    organisationId: string,
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
    return query;
  }
}
