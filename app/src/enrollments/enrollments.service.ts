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
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly cacheConfig: CacheConfigService,
  ) {}

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

    if (filters?.hasEnroll === true && filters?.trackingStatus && filters?.userId) {
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

  private applyTrackingStatusFilter(qb: any, status: TrackingStatus): void {
    if (status === TrackingStatus.NOT_STARTED) {
      qb.andWhere(
        '(NOT EXISTS (SELECT 1 FROM "course_track" "ct" WHERE "ct"."courseId" = "course"."courseId" AND "ct"."userId" = :userId AND "ct"."tenantId" = :tenantId AND "ct"."organisationId" = :organisationId) OR EXISTS (SELECT 1 FROM "course_track" "ct" WHERE "ct"."courseId" = "course"."courseId" AND "ct"."userId" = :userId AND "ct"."tenantId" = :tenantId AND "ct"."organisationId" = :organisationId AND "ct"."status" = :trackingStatus))',
        { trackingStatus: status },
      );
    } else {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM "course_track" "ct" WHERE "ct"."courseId" = "course"."courseId" AND "ct"."userId" = :userId AND "ct"."tenantId" = :tenantId AND "ct"."organisationId" = :organisationId AND "ct"."status" = :trackingStatus)',
        { trackingStatus: status },
      );
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
      .where('module.courseId IN (:...courseIds)', { courseIds })
      .andWhere('module.tenantId = :tenantId', { tenantId })
      .andWhere('module.status != :archivedStatus', {
        archivedStatus: ModuleStatus.ARCHIVED,
      })
      .groupBy('module.courseId')
      .getRawMany<{ courseId: string; count: string }>();

    const countMap = new Map(
      counts.map((row) => [row.courseId, Number(row.count)]),
    );

    return courses.map((course) => ({
      ...course,
      totalModuleCount: countMap.get(course.courseId) || 0,
    }));
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
        completedModuleCount: Number(progress?.completedModuleCount ?? 0),
        courseTracking: progress?.courseTracking ?? null,
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
}
