import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, LessThan, MoreThan, FindOptionsWhere, DataSource } from 'typeorm';
import { UserEnrollment, EnrollmentStatus } from './entities/user-enrollment.entity';
import { Course } from '../courses/entities/course.entity';
import { CourseStatus } from '../courses/entities/course.entity';
import { CourseTrack } from '../tracking/entities/course-track.entity';
import { TrackingStatus } from '../tracking/entities/course-track.entity';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { Lesson, LessonStatus } from '../lessons/entities/lesson.entity';
import { Module as CourseModule, ModuleStatus } from '../modules/entities/module.entity';
import { ModuleTrack, ModuleTrackStatus } from '../tracking/entities/module-track.entity';
import { InjectDataSource } from '@nestjs/typeorm';
import { CacheConfigService } from '../cache/cache-config.service';


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
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly cacheConfig: CacheConfigService,
  ) {}

  /**
   * Enroll a user for a course
   * @param createEnrollmentDto The enrollment data
   * @param organisationId The organization ID for data isolation
   */
  async enroll(
    createEnrollmentDto: CreateEnrollmentDto,
    userId: string,
    tenantId: string,
    organisationId: string
  ): Promise<UserEnrollment> {
    this.logger.log(`Enrolling user: ${JSON.stringify(createEnrollmentDto)}`);
    
    // Create a query runner for transaction
    const queryRunner = this.dataSource.createQueryRunner();

    try{
    await queryRunner.connect();
    await queryRunner.startTransaction();
      const { courseId } = createEnrollmentDto;
      
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
      const existingEnrollment = await queryRunner.manager.findOne(UserEnrollment, {
        where: enrollmentWhereClause,
      });
      
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
          throw new BadRequestException(RESPONSE_MESSAGES.ERROR.INVALID_PARAMS_FORMAT);
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
          status: ModuleStatus.PUBLISHED
        }
      });

      // Count total lessons for the course (only published lessons in published modules)
      const courseLessons = await queryRunner.manager
        .createQueryBuilder(Lesson, 'lesson')
        .innerJoin('lesson.module', 'module')
        .where('lesson.status = :lessonStatus', { lessonStatus: LessonStatus.PUBLISHED })
        .andWhere('module.status = :moduleStatus', { moduleStatus: ModuleStatus.PUBLISHED })
        .andWhere('module.courseId = :courseId', { courseId })
        .andWhere('lesson.tenantId = :tenantId', { tenantId })
        .andWhere('lesson.organisationId = :organisationId', { organisationId })
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
        const moduleIds = modules.map(m => m.moduleId);

        const lessonCounts = await queryRunner.manager
          .createQueryBuilder(Lesson, 'lesson')
          .select('lesson.moduleId', 'moduleId')
          .addSelect('COUNT(*)', 'count')
          .where('lesson.moduleId IN (:...moduleIds)', { moduleIds })
          .andWhere('lesson.status = :lessonStatus', { lessonStatus: LessonStatus.PUBLISHED })
          .andWhere('lesson.tenantId = :tenantId', { tenantId })
          .andWhere('lesson.organisationId = :organisationId', { organisationId })
          .groupBy('lesson.moduleId')
          .getRawMany();

        // Step 2: Build a map of moduleId to lesson count
        const lessonCountMap = new Map<string, number>();
        lessonCounts.forEach(row => {
          lessonCountMap.set(row.moduleId, parseInt(row.count, 10));
        });

        // Step 3: Create ModuleTrack records
        const moduleTracks = modules.map(module => {
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
      const completeEnrollment = await queryRunner.manager.findOne(UserEnrollment, {
        where: { enrollmentId: savedEnrollment.enrollmentId },
        // relations: ['course'],
      });

      if (!completeEnrollment) {
        throw new InternalServerErrorException(RESPONSE_MESSAGES.ENROLLMENT_ERROR);
      }

      // Commit the transaction
      await queryRunner.commitTransaction();

      // Cache the new enrollment and invalidate related caches
      const enrollmentKey = this.cacheConfig.getEnrollmentKey(savedEnrollment.userId, savedEnrollment.courseId, tenantId, organisationId);
      await Promise.all([
        this.cacheService.invalidateEnrollment(savedEnrollment.userId, savedEnrollment.courseId, tenantId, organisationId),
        this.cacheService.set(enrollmentKey, savedEnrollment, this.cacheConfig.ENROLLMENT_TTL),
      ]);
      
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
      throw new InternalServerErrorException(RESPONSE_MESSAGES.ENROLLMENT_ERROR);
    } finally {
      // Release the query runner
      await queryRunner.release();
    }
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
      const cacheKey = this.cacheConfig.getEnrollmentListKey(tenantId, organisationId, learnerId || '', courseId || '',status || '',page,limit);

      // Try to get from cache first
      const cachedResult = await this.cacheService.get<{ count: number; enrollments: UserEnrollment[] }>(cacheKey);
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
      const [enrollments, count] = await this.userEnrollmentRepository.findAndCount({
        where: whereConditions,
        skip,
        take: limit,
        order: {
          enrolledOnTime: 'DESC',
        },
        // relations: ['course'],
      });

      const result = { count, enrollments };

      // Cache the result with standardized TTL
      await this.cacheService.set(cacheKey, result, this.cacheConfig.ENROLLMENT_TTL);

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
    organisationId: string
  ): Promise<UserEnrollment> {
    try {

      // Check cache using the enrollment's userId and courseId
      const cacheKey = this.cacheConfig.getUserEnrollmentKey(
        enrollmentId,
        tenantId,
        organisationId
      );
      const cachedEnrollment = await this.cacheService.get<UserEnrollment>(cacheKey);
      
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

      // Cache the enrollment with TTL
      await this.cacheService.set(cacheKey, enrollment, this.cacheConfig.ENROLLMENT_TTL);

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
   * Update an enrollment
   */
  async update(
    enrollmentId: string,
    updateEnrollmentDto: UpdateEnrollmentDto,
    tenantId: string,
    organisationId: string
  ): Promise<UserEnrollment> {
    try {
      const enrollment = await this.findOne(enrollmentId, tenantId, organisationId);

      // Update enrollment fields
      Object.assign(enrollment, updateEnrollmentDto);

      // Save updated enrollment
      const updatedEnrollment = await this.userEnrollmentRepository.save(enrollment);

      // Update cache and invalidate related caches
      const enrollmentKey = this.cacheConfig.getEnrollmentKey(updatedEnrollment.userId, updatedEnrollment.courseId, tenantId, organisationId);
      await Promise.all([
        this.cacheService.invalidateEnrollment(updatedEnrollment.userId, updatedEnrollment.courseId, tenantId, organisationId),
        this.cacheService.del(this.cacheConfig.getUserEnrollmentKey(enrollmentId, tenantId, organisationId)),
        this.cacheService.set(enrollmentKey, updatedEnrollment, this.cacheConfig.ENROLLMENT_TTL),
      ]);

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
   * Cancel an enrollment
   */
  async cancel(
    enrollmentId: string,
    tenantId: string,
    organisationId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const enrollment = await this.findOne(enrollmentId, tenantId, organisationId);

      if (enrollment.status === EnrollmentStatus.UNPUBLISHED) {
        throw new BadRequestException(RESPONSE_MESSAGES.ERROR.ENROLLMENT_ALREADY_CANCELLED);
      }

      // Update enrollment status
      enrollment.status = EnrollmentStatus.UNPUBLISHED;
      await this.userEnrollmentRepository.save(enrollment);

      // Invalidate all related caches
      const enrollmentKey = this.cacheConfig.getEnrollmentKey(enrollment.userId, enrollment.courseId, tenantId, organisationId);
      await Promise.all([
        this.cacheService.del(this.cacheConfig.getUserEnrollmentKey(enrollmentId, tenantId, organisationId)),
        this.cacheService.del(enrollmentKey),
        this.cacheService.invalidateEnrollment(enrollment.userId, enrollment.courseId, tenantId, organisationId),
      ]);

      return {
        success: true,
        message: RESPONSE_MESSAGES.ENROLLMENT_CANCELLED,
      };
    } catch (error) {
      this.logger.error(`Error cancelling enrollment: ${error.message}`);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(RESPONSE_MESSAGES.CANCELLATION_ERROR);
    }
  }
}
