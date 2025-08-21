import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Not, Equal, ILike, IsNull, In } from 'typeorm';
import { Course, CourseStatus } from './entities/course.entity';
import { Module, ModuleStatus } from '../modules/entities/module.entity';
import { Lesson, LessonStatus, AttemptsGradeMethod } from '../lessons/entities/lesson.entity';
import { CourseTrack, TrackingStatus } from '../tracking/entities/course-track.entity';
import { LessonTrack } from '../tracking/entities/lesson-track.entity';
import { ModuleTrack } from '../tracking/entities/module-track.entity';
import { Media } from '../media/entities/media.entity';
import { AssociatedFile } from '../media/entities/associated-file.entity';
import { UserEnrollment, EnrollmentStatus } from '../enrollments/entities/user-enrollment.entity';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { HelperUtil } from '../common/utils/helper.util';
import { CreateCourseDto } from './dto/create-course.dto';
import { SearchCourseDto, SearchCourseResponseDto, SortBy, SortOrder } from './dto/search-course.dto';
import { CacheService } from '../cache/cache.service';
import { CourseStructureDto } from '../courses/dto/course-structure.dto';
import { CacheConfigService } from '../cache/cache-config.service';
import { ModulesService } from 'src/modules/modules.service';
import { OrderingService } from '../common/services/ordering.service';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Module)
    private readonly moduleRepository: Repository<Module>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(CourseTrack)
    private readonly courseTrackRepository: Repository<CourseTrack>,
    @InjectRepository(LessonTrack)
    private readonly lessonTrackRepository: Repository<LessonTrack>,
    @InjectRepository(ModuleTrack)
    private readonly moduleTrackRepository: Repository<ModuleTrack>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(AssociatedFile)
    private readonly associatedFileRepository: Repository<AssociatedFile>,
    @InjectRepository(UserEnrollment)
    private readonly userEnrollmentRepository: Repository<UserEnrollment>,
    private readonly cacheService: CacheService,
    private readonly cacheConfig: CacheConfigService,
    private readonly modulesService: ModulesService,
    private readonly orderingService: OrderingService,
  ) {}

  /**
   * Create a new course
   */
  async create(
    createCourseDto: CreateCourseDto,
    userId: string,
    tenantId: string,
    organisationId: string,
  ): Promise<Course> {
    this.logger.log(`Creating course: ${JSON.stringify(createCourseDto)}`);

    // Generate a simple alias from the title if none provided
    if (!createCourseDto.alias) {
      createCourseDto.alias = await HelperUtil.generateUniqueAliasWithRepo(
        createCourseDto.title,
        this.courseRepository,
        tenantId,
        organisationId
      );
    } else {
      // Check if the alias already exists
      const existingCourse = await this.courseRepository.findOne({
        where: { 
          alias: createCourseDto.alias, 
          tenantId,
          ...(organisationId && { organisationId }),
          status: Not(CourseStatus.ARCHIVED)
        } as FindOptionsWhere<Course>,
      });

      if (existingCourse) {
        const originalAlias = createCourseDto.alias;
        createCourseDto.alias = await HelperUtil.generateUniqueAliasWithRepo(
          originalAlias,
          this.courseRepository,
          tenantId,
          organisationId
        );
        this.logger.log(`Alias '${originalAlias}' already exists. Generated new alias: ${createCourseDto.alias}`);
      }
    }
    
    // Get the next ordering number for the course
    const nextOrdering = await this.orderingService.getNextCourseOrder(tenantId, organisationId);
    
    // Create courseData with only fields that exist in the entity
    const courseData = {
      title: createCourseDto.title,
      alias: createCourseDto.alias,
      description: createCourseDto.description,
      shortDescription: createCourseDto.shortDescription,
      image: createCourseDto.image,
      startDatetime: createCourseDto.startDatetime,
      endDatetime: createCourseDto.endDatetime,
      status: createCourseDto.status,
      params: createCourseDto.params || {},
      featured: createCourseDto.featured !== undefined ? createCourseDto.featured : false,
      free: createCourseDto.free !== undefined ? createCourseDto.free : false,
      adminApproval: createCourseDto.adminApproval !== undefined ? createCourseDto.adminApproval : false,
      autoEnroll: createCourseDto.autoEnroll !== undefined ? createCourseDto.autoEnroll : false,
      certificateTerm: createCourseDto.certificateTerm ? { term: createCourseDto.certificateTerm } : undefined,
      rewardType: createCourseDto.rewardType,
      templateId: createCourseDto.templateId,
      prerequisites: createCourseDto.prerequisites,
      ordering: nextOrdering,
      tenantId,
      organisationId,
      createdBy: userId,
      updatedBy: userId,
    };
    
    const course = this.courseRepository.create(courseData);
    const savedCourse = await this.courseRepository.save(course);
    const result = Array.isArray(savedCourse) ? savedCourse[0] : savedCourse;
    
    // Cache the new course and invalidate related caches
    await Promise.all([
      this.cacheService.setCourse(result),
      this.cacheService.invalidateCourse(result.courseId, tenantId, organisationId),
    ]);
    
    return result;
  }

  /**
   * Search courses with filters and keyword search
   */
  async search(
    filters: SearchCourseDto,
    tenantId: string,
    organisationId: string,
  ): Promise<SearchCourseResponseDto> {
    // Validate and sanitize inputs
    const offset = Math.max(0, filters.offset || 0);
    const limit = Math.min(100, Math.max(1, filters.limit || 10));
    const sortBy = filters.sortBy || SortBy.CREATED_AT;
    const orderBy = filters.orderBy || SortOrder.DESC;

    // Generate consistent cache key
    const cacheKey = this.cacheConfig.getCourseSearchKey(
      tenantId,
      organisationId,
      filters,
      offset,
      limit
    );
    
    // Check cache
    const cachedResult = await this.cacheService.get<SearchCourseResponseDto>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // Build base where clause
    const whereClause: any = { 
      tenantId,
      organisationId,
      status: filters?.status || Not(CourseStatus.ARCHIVED),
    };

    // Apply filters
    this.applyFilters(filters, whereClause);

    // Build order clause
    const orderClause: any = {};
    orderClause[sortBy] = orderBy;

    // Fetch courses - can use Join query to get courses , module and enrollment counts in future if there are more courses - with aspire case one cohort can hvae 2-5 courses.
    const [courses, total] = await this.courseRepository.findAndCount({
      where: this.buildSearchConditions(filters, whereClause),
      order: orderClause,
      take: limit,
      skip: offset,
    });

    // Batch fetch module and enrollment counts
    const coursesWithCounts = await this.enrichCoursesWithCounts(
      courses,
      tenantId
    );

    const result: SearchCourseResponseDto = { 
      courses: coursesWithCounts, 
      totalElements: total,
      offset,
      limit
    };

    // Cache result
    await this.cacheService.set(cacheKey, result, this.cacheConfig.COURSE_TTL);

    return result;
  }

  private applyFilters(filters: any, whereClause: any): void {
    // Cohort filter
    if (filters?.cohortId) {
      whereClause.params = {
        ...(whereClause.params || {}),
        cohortId: filters.cohortId
      };
    }

    // Boolean filters
    const booleanFilters = ['featured', 'free'];
    booleanFilters.forEach(filter => {
      if (filters?.[filter] !== undefined) {
        whereClause[filter] = filters[filter];
      }
    });

    // Creator filter
    if (filters?.createdBy) {
      whereClause.createdBy = filters.createdBy;
    }

    // Date range filters
    this.applyDateFilters(filters, whereClause);
  }

  private applyDateFilters(filters: any, whereClause: any): void {
    // Start date range
    if (filters?.startDateFrom || filters?.startDateTo) {
      whereClause.startDatetime = whereClause.startDatetime || {};
      if (filters.startDateFrom) {
        whereClause.startDatetime.gte = filters.startDateFrom;
      }
      if (filters.startDateTo) {
        whereClause.startDatetime.lte = filters.startDateTo;
      }
    }

    // End date range
    if (filters?.endDateFrom || filters?.endDateTo) {
      whereClause.endDatetime = whereClause.endDatetime || {};
      if (filters.endDateFrom) {
        whereClause.endDatetime.gte = filters.endDateFrom;
      }
      if (filters.endDateTo) {
        whereClause.endDatetime.lte = filters.endDateTo;
      }
    }
  }

  private buildSearchConditions(
    filters: any,
    baseWhere: any
  ): any[] | any {
    if (!filters?.query) return baseWhere;

    return [
      { title: ILike(`%${filters.query}%`), ...baseWhere },
      { description: ILike(`%${filters.query}%`), ...baseWhere },
      { shortDescription: ILike(`%${filters.query}%`), ...baseWhere }
    ];
  }

  private async enrichCoursesWithCounts(
    courses: Course[],
    tenantId: string
  ): Promise<Course[]> {
    if (courses.length === 0) return [];

    const courseIds = courses.map(c => c.courseId);
    
    // Get module counts using count method
    const moduleCountPromises = courseIds.map(async (courseId) => {
      const count = await this.moduleRepository.count({
        where: {
          courseId,
          tenantId,
          status: Not(ModuleStatus.ARCHIVED)
        }
      });
      return { courseId, count };
    });

    const moduleCounts = await Promise.all(moduleCountPromises);

    // Get enrollment counts using count method
    const enrollmentCountPromises = courseIds.map(async (courseId) => {
      const count = await this.userEnrollmentRepository.count({
        where: {
          courseId,
          tenantId,
          status: EnrollmentStatus.PUBLISHED
        }
      });
      return { courseId, count };
    });

    const enrollmentCounts = await Promise.all(enrollmentCountPromises);

    const moduleCountMap = new Map(
      moduleCounts.map(mc => [mc.courseId, mc.count])
    );
    
    const enrollmentCountMap = new Map(
      enrollmentCounts.map(ec => [ec.courseId, ec.count])
    );

    return courses.map(course => ({
      ...course,
      moduleCount: moduleCountMap.get(course.courseId) || 0,
      enrolledUsersCount: enrollmentCountMap.get(course.courseId) || 0
    }));
  }

  /**
   * Find one course by ID
   * @param courseId The course ID to find
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   * @returns The found course
   */
  async findOne(
    courseId: string, 
    tenantId: string, 
    organisationId: string
  ): Promise<Course> {
    // Standardized cache handling for findOne
    const cachedCourse = await this.cacheService.getCourse(courseId, tenantId, organisationId);
    if (cachedCourse) {
      return cachedCourse;
    }

    const whereClause: FindOptionsWhere<Course> = { courseId };
    
    // Apply tenant and organization filters if provided
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }
    
    if (organisationId) {
      whereClause.organisationId = organisationId;
    }
    
    const course = await this.courseRepository.findOne({
      where: whereClause,
    });

    if (!course) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.COURSE_NOT_FOUND);
    }

    // Cache the course
    await this.cacheService.setCourse(course);
    return course;
  }

  /**
   * Find course hierarchy (with modules and lessons)
   * @param courseId The course ID to find
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async findCourseHierarchy(courseId: string, tenantId: string, organisationId: string): Promise<any> {
    // Check cache first
    const cacheKey = this.cacheConfig.getCourseHierarchyKey(
      courseId,
      tenantId,
      organisationId
    );
    const cachedHierarchy = await this.cacheService.get<any>(cacheKey);
    if (cachedHierarchy) {
      return cachedHierarchy;
    }

    // If not in cache, get from database
    const course = await this.findOne(courseId, tenantId, organisationId);
    
    // For data isolation, ensure we filter modules by tenantId as well
    const moduleWhereClause: any = { 
      courseId,
      parentId: IsNull(),
      tenantId,
      organisationId,
      status: Not(ModuleStatus.ARCHIVED as any),
    };

    // Fetch all modules related to this course with proper isolation
    const modules = await this.moduleRepository.find({
      where: moduleWhereClause,
      order: { ordering: 'ASC' },
    });

    // For each module, fetch sub-modules and lessons
    const enrichedModules = await Promise.all(
      modules.map(async (module) => {
        // Fetch all lessons for this module
        const moduleLessons = await this.lessonRepository.find({
          where: { 
            moduleId: module.moduleId, 
            status: Not(LessonStatus.ARCHIVED),
            ...(tenantId && { tenantId }),
            ...(organisationId && { organisationId }),
          },
          relations: ['media'],
          order: { ordering: 'ASC' },
        });

        // Fetch all submodules for this module
        const submodules = await this.moduleRepository.find({
          where: { 
            parentId: module.moduleId,
            status: Not(ModuleStatus.ARCHIVED as any),
            ...(tenantId && { tenantId }),
            ...(organisationId && { organisationId }),
          },
          order: { ordering: 'ASC' },
        });

        const enrichedSubmodules = await Promise.all(
          submodules.map(async (submodule) => {
            const submoduleLessons = await this.lessonRepository.find({
              where: { 
                moduleId: submodule.moduleId, 
                status: Not(LessonStatus.ARCHIVED),
                ...(tenantId && { tenantId }),
                ...(organisationId && { organisationId }),
              },
              relations: ['media'],
              order: { ordering: 'ASC' },
            });

            return {
              ...submodule,
              lessons: submoduleLessons,
            };
          })
        );

        return {
          ...module,
          lessons: moduleLessons,
          submodules: enrichedSubmodules,
        };
      })
    );

    const result = {
      ...course,
      modules: enrichedModules,
    };
   
    await this.cacheService.set(cacheKey, result, this.cacheConfig.COURSE_TTL);
    
    return result;
  }

  /**
   * Find course hierarchy with tracking information
   * @param courseId The course ID to find
   * @param userId The user ID for tracking data
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   * @param filterType Optional filter type ('module' or 'lesson')
   * @param moduleId Required moduleId when filterType is 'lesson'
   */
  async findCourseHierarchyWithTracking(
    courseId: string,
    userId: string,
    tenantId: string,
    organisationId: string,
    includeModules: boolean = false,
    includeLessons: boolean = false,
    moduleId?: string
  ): Promise<any> {
    // If includeLessons is true and moduleId is provided, only fetch that module and its lessons
    // If includeLessons is true and no moduleId, fetch all modules and all lessons
    // If includeModules is true and includeLessons is false, fetch only modules (no lessons)
    // If neither is set, return only course-level info

    // Batch load all required data efficiently using Promise.all
    const [course, isEnrolled, isCourseCompleted] = await Promise.all([
      this.courseRepository.findOne({
        where: {
          courseId,
          tenantId,
          organisationId,
          status: CourseStatus.PUBLISHED
        }
      }),
      this.isUserEnrolled(courseId, userId, tenantId, organisationId),
      this.isCourseCompleted(courseId, userId, tenantId, organisationId)
    ]);

    if (!course) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.COURSE_NOT_FOUND);
    }
    if (!isEnrolled) {
      throw new BadRequestException(RESPONSE_MESSAGES.ERROR.USER_NOT_ENROLLED);
    }

    // Determine eligibility
    let eligibility: { isEligible: boolean, requiredCourses: any[] };
    if (isCourseCompleted) {
      eligibility = { isEligible: true, requiredCourses: [] };
    } else {
      eligibility = await this.checkCourseEligibility(course, userId, tenantId, organisationId);
    }

    // If neither modules nor lessons are requested, return only course-level info
    if (!includeModules && !includeLessons) {
      const courseTracking = await this.courseTrackRepository.findOne({
        where: { courseId, userId, tenantId, organisationId }
      });
      // Determine tracking status based on eligibility
      let trackingStatus = TrackingStatus.NOT_STARTED;
      if (!eligibility.isEligible) {
        trackingStatus = TrackingStatus.NOT_ELIGIBLE;
      } else if (courseTracking) {
        trackingStatus = courseTracking.status;
      }
      
      return {
        ...course,
        modules: [],
        tracking: courseTracking ? {
          ...courseTracking,
          status: trackingStatus,
          totalLessons: courseTracking.noOfLessons,
        } : {
          status: trackingStatus,
          progress: 0,
          completedLessons: 0,
          totalLessons: 0,
          lastAccessed: null,
          timeSpent: 0,
          startDatetime: null,
          endDatetime: null,
        },
        lastAccessedLesson: null,
        eligibility: {
          requiredCourses: eligibility.requiredCourses,
          isEligible: eligibility.isEligible
        }
      };
    }

    // Build module where clause
    const moduleWhere: any = {
      courseId,
      tenantId,
      organisationId,
      status: ModuleStatus.PUBLISHED
    };
    if (includeLessons && moduleId) {
      moduleWhere.moduleId = moduleId;
    }
    const modules = includeModules || includeLessons
      ? await this.moduleRepository.find({
          where: moduleWhere,
          order: { ordering: 'ASC', createdAt: 'ASC' }
        })
      : [];
    if (includeLessons && moduleId && modules.length === 0) {
      throw new BadRequestException(RESPONSE_MESSAGES.ERROR.MODULE_NOT_FOUND_IN_COURSE(moduleId!));
    }
    const moduleIds = modules.map(m => m.moduleId);

    // Only fetch lessons when needed
    let lessons: any[] = [];
    let lessonsByModule = new Map();
    if (includeLessons) {
      const lessonWhere: any = {
        courseId,
        tenantId,
        organisationId,
        status: LessonStatus.PUBLISHED
      };
      if (moduleId) {
        lessonWhere.moduleId = moduleId;
      } else {
        lessonWhere.moduleId = In(moduleIds);
      }
      lessons = await this.lessonRepository.find({
        where: lessonWhere,
        order: { ordering: 'ASC', createdAt: 'ASC' },
        relations: ['media']
      });
      lessons.forEach(lesson => {
        if (!lessonsByModule.has(lesson.moduleId)) {
          lessonsByModule.set(lesson.moduleId, []);
        }
        lessonsByModule.get(lesson.moduleId).push(lesson);
      });
    }

    // Tracking - fetch lesson tracks only when lessons are fetched
    const courseTracking = await this.courseTrackRepository.findOne({
      where: { courseId, userId, tenantId, organisationId }
    });
    let lessonTracks: any[] = [];
    let lessonAttemptsByLesson = new Map(); // Map to store all attempts for each lesson
    let totalTimeSpent = 0;
    let lastAccessedLesson: any = null;
    if (includeLessons && lessons.length > 0) {
      lessonTracks = await this.lessonTrackRepository.find({
        where: { userId, courseId, tenantId, organisationId },
        order: { updatedAt: 'DESC', attempt: 'DESC' }
      });
      
      // Group all attempts by lessonId
      lessonTracks.forEach(track => {
        if (!lessonAttemptsByLesson.has(track.lessonId)) {
          lessonAttemptsByLesson.set(track.lessonId, []);
        }
        lessonAttemptsByLesson.get(track.lessonId).push(track);
      });
      
      totalTimeSpent = lessonTracks.reduce((sum, track) => sum + (track.timeSpent || 0), 0);
      if (courseTracking && courseTracking.status !== TrackingStatus.COMPLETED && lessonTracks.length > 0) {
        const lastTrack = lessonTracks[0];
        lastAccessedLesson = {
          lessonId: lastTrack.lessonId,
          attempt: {
            attemptId: lastTrack.lessonTrackId,
            attemptNumber: lastTrack.attempt,
            status: lastTrack.status,
            startDatetime: lastTrack.startDatetime,
            endDatetime: lastTrack.endDatetime,
            score: lastTrack.score,
            completionPercentage: lastTrack.completionPercentage || 0,
            timeSpent: lastTrack.timeSpent || 0,
            lastAccessed: lastTrack.updatedAt,
            totalContent: lastTrack.totalContent || 0,
            currentPosition: lastTrack.currentPosition || 0
          }
        };
      }
    }

    const moduleTracks = (includeModules || includeLessons)
      ? await this.moduleTrackRepository.find({ where: { userId, tenantId, organisationId } })
      : [];
    const moduleTrackMap = new Map();
    moduleTracks.forEach(track => {
      moduleTrackMap.set(track.moduleId, track);
    });

    // Build modules with tracking
    const modulesWithTracking = modules.map(module => {
      let lessonsWithTracking: any[] = [];
      if (includeLessons) {
        const moduleLessons = lessonsByModule.get(module.moduleId) || [];
        lessonsWithTracking = moduleLessons.map(lesson => {
          const lessonAttempts = lessonAttemptsByLesson.get(lesson.lessonId) || [];
          const bestAttempt = this.calculateBestAttempt(lessonAttempts, lesson.attemptsGrade);
          const lastAttempt = this.getLastAttempt(lessonAttempts);
          
          return {
            ...lesson,
            tracking: bestAttempt ? {
              status: bestAttempt.status,
              canResume: lesson.allowResubmission ? true : (lesson.resume ?? true) && (lastAttempt && (lastAttempt.status === TrackingStatus.STARTED || lastAttempt.status === TrackingStatus.INCOMPLETE)),
              canReattempt: lesson.allowResubmission ? true : (lesson.noOfAttempts === 0 || (lastAttempt && lastAttempt.attempt < lesson.noOfAttempts)) && (lastAttempt && lastAttempt.status === TrackingStatus.COMPLETED),              
              completionPercentage: bestAttempt.completionPercentage || 0,
              lastAccessed: bestAttempt.updatedAt,
              timeSpent: bestAttempt.timeSpent || 0,
              score: bestAttempt.score,
              attempt: lastAttempt ? {
                attemptId: lastAttempt.lessonTrackId,
                attemptNumber: lastAttempt.attempt,
                startDatetime: lastAttempt.startDatetime,
                endDatetime: lastAttempt.endDatetime,
                totalContent: lastAttempt.totalContent || 0,
                currentPosition: lastAttempt.currentPosition || 0
              } : null
            } : {
              status: TrackingStatus.NOT_STARTED,
              progress: 0,
              lastAccessed: null,
              timeSpent: 0,
              score: null,
              attempt: null
            }
          };
        });
      }
      const moduleTrack = moduleTrackMap.get(module.moduleId);
      return {
        ...module,
        lessons: lessonsWithTracking, // Will be empty array if not includeLessons
        tracking: moduleTrack ? {
          status: moduleTrack.status,
          progress: moduleTrack.progress,
          completedLessons: moduleTrack.completedLessons,
          totalLessons: moduleTrack.totalLessons,
        } : {
          status: TrackingStatus.NOT_STARTED,
          progress: 0,
          completedLessons: 0,
          totalLessons: (lessonsByModule.get(module.moduleId) || []).length,
        }
      };
    });

    // If includeLessons and moduleId, return only the target module with lessons
    if (includeLessons && moduleId) {
      const targetModule = modulesWithTracking[0];
      return {
        ...targetModule,
        courseId: course.courseId,
        tenantId: course.tenantId,
        organisationId: course.organisationId,
        eligibility: {
          requiredCourses: eligibility.requiredCourses,
          isEligible: eligibility.isEligible
        }
      };
    }

    // Otherwise, return the full structure as requested
    
    const courseProgress = courseTracking?.completedLessons && courseTracking.noOfLessons > 0
      ? Math.round((courseTracking?.completedLessons / courseTracking.noOfLessons) * 100)
      : 0;
    
    // Determine tracking status based on eligibility
    let trackingStatus = TrackingStatus.NOT_STARTED;
    if (!eligibility.isEligible) {
      trackingStatus = TrackingStatus.NOT_ELIGIBLE;
    } else if (courseTracking) {
      trackingStatus = courseTracking.status;
    }
    
    return {
      ...course,
      modules: modulesWithTracking,
      tracking: courseTracking ? {
        status: trackingStatus,
        progress: courseProgress,
        completedLessons: courseTracking.completedLessons,
        totalLessons: courseTracking.noOfLessons,
        lastAccessed: courseTracking.lastAccessedDate,
        timeSpent: totalTimeSpent,
        startDatetime: courseTracking.startDatetime,
        endDatetime: courseTracking.endDatetime,
      } : {
        status: trackingStatus,
        progress: 0,
        completedLessons: 0,
        totalLessons: 0,
        lastAccessed: null,
        timeSpent: 0,
        startDatetime: null,
        endDatetime: null,
      },
      lastAccessedLesson,
      eligibility: {
        requiredCourses: eligibility.requiredCourses,
        isEligible: eligibility.isEligible
      }
    };
  }

  /**
   * Helper method to find the most recent access time from a collection of tracked items
   */
  private findMostRecentAccess(items: any[]): Date | null {
    const dates = items
      .map(item => item.tracking?.lastAccessed)
      .filter(date => date !== null && date !== undefined);
    
    if (dates.length === 0) return null;
    
    return new Date(Math.max(...dates.map(date => date instanceof Date ? date.getTime() : new Date(date).getTime())));
  }

  /**
   * Calculate the best attempt based on the grading method
   * @param attempts Array of lesson attempts
   * @param gradingMethod The grading method to use
   * @returns The best attempt based on the grading method
   */
  private calculateBestAttempt(attempts: LessonTrack[], gradingMethod: AttemptsGradeMethod): LessonTrack | null {
    if (!attempts || attempts.length === 0) {
      return null;
    }

    switch (gradingMethod) {
      case AttemptsGradeMethod.FIRST_ATTEMPT:
        return attempts.sort((a, b) => a.attempt - b.attempt)[0];
      
      case AttemptsGradeMethod.LAST_ATTEMPT:
        return attempts.sort((a, b) => b.attempt - a.attempt)[0];
      
      case AttemptsGradeMethod.HIGHEST:
        return attempts.reduce((best, current) => {
          const bestScore = best.score || 0;
          const currentScore = current.score || 0;
          return currentScore > bestScore ? current : best;
        });
      
      case AttemptsGradeMethod.AVERAGE:
        // For average, we need to calculate averages and return a synthetic attempt
        const totalScore = attempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0);
        const totalCompletion = attempts.reduce((sum, attempt) => sum + (attempt.completionPercentage || 0), 0);
        const totalTimeSpent = attempts.reduce((sum, attempt) => sum + (attempt.timeSpent || 0), 0);
        
        const avgScore = totalScore / attempts.length;
        const avgCompletion = totalCompletion / attempts.length;
        const avgTimeSpent = totalTimeSpent / attempts.length;
        
        // Return the attempt with the closest score to average, or the last attempt if no score
        const attemptWithClosestScore = attempts.reduce((closest, current) => {
          const closestDiff = Math.abs((closest.score || 0) - avgScore);
          const currentDiff = Math.abs((current.score || 0) - avgScore);
          return currentDiff < closestDiff ? current : closest;
        });
        
        // Create a synthetic attempt with average values
        return {
          ...attemptWithClosestScore,
          score: Math.round(avgScore),
          completionPercentage: Math.round(avgCompletion),
          timeSpent: Math.round(avgTimeSpent)
        };
      
      default:
        // Default to last attempt
        return attempts.sort((a, b) => b.attempt - a.attempt)[0];
    }
  }

  /**
   * Get the last attempt for a lesson (for attempt object in response)
   * @param attempts Array of lesson attempts
   * @returns The last attempt
   */
  private getLastAttempt(attempts: LessonTrack[]): LessonTrack | null {
    if (!attempts || attempts.length === 0) {
      return null;
    }
    return attempts.sort((a, b) => b.attempt - a.attempt)[0];
  }

  /**
   * Check if a user has completed a specific course
   * @param courseId The course ID to check
   * @param userId The user ID
   * @param tenantId The tenant ID
   * @param organisationId The organization ID
   * @returns Promise<boolean> True if course is completed, false otherwise
   */
  private async isCourseCompleted(
    courseId: string,
    userId: string,
    tenantId: string,
    organisationId: string
  ): Promise<boolean> {
    const courseTrack = await this.courseTrackRepository.findOne({
      where: { 
        courseId, 
        userId, 
        tenantId, 
        organisationId 
      }
    });
    
    return courseTrack?.status === TrackingStatus.COMPLETED;
  }

  /**
   * Check if user is enrolled in the course
   * @param courseId The course ID to check
   * @param userId The user ID
   * @param tenantId The tenant ID
   * @param organisationId The organization ID
   * @returns Promise<boolean> True if user is enrolled, false otherwise
   */
  private async isUserEnrolled(
    courseId: string,
    userId: string,
    tenantId: string,
    organisationId: string
  ): Promise<boolean> {
    const enrollment = await this.userEnrollmentRepository.findOne({
      where: {
        courseId,
        userId,
        tenantId,
        organisationId,
        status: EnrollmentStatus.PUBLISHED
      }
    });
    
    return !!enrollment;
  }

  /**
   * Check course eligibility based on prerequisite courses
   * @param course The course to check eligibility for
   * @param userId The user ID
   * @param tenantId The tenant ID
   * @param organisationId The organization ID
   * @returns Promise<{isEligible: boolean, requiredCourses: any[]}>
   */
  private async checkCourseEligibility(
    course: Course,
    userId: string,
    tenantId: string,
    organisationId: string
  ): Promise<{isEligible: boolean, requiredCourses: any[]}> {
    // If no prerequisites, user is eligible
    if (!course.prerequisites || course.prerequisites.length === 0) {
      return {
        isEligible: true,
        requiredCourses: []
      };
    }

    const currentCourseCohortId = course.params?.cohortId;
    const requiredCourses: any[] = [];
    let allCompleted = true;

    // Check each required course ID from the array
    for (const requiredCourseId of course.prerequisites) {

      // Fetch the required course details
      const requiredCourse = await this.courseRepository.findOne({
        where: {
          courseId: requiredCourseId,
          tenantId,
          organisationId,
          status: CourseStatus.PUBLISHED
        },
        select: ['courseId', 'title', 'params']
      });

      if (!requiredCourse) {
        // If required course doesn't exist, consider it as not completed
        requiredCourses.push({
          courseId: requiredCourseId,
          title: 'Unknown Course',
          completed: false
        });
        allCompleted = false;
        continue;
      }

      // Check if the user has completed this course
      const isCompleted = await this.isCourseCompleted(
        requiredCourseId,
        userId,
        tenantId,
        organisationId
      );

      requiredCourses.push({
        courseId: requiredCourseId,
        title: requiredCourse.title,
        completed: isCompleted
      });

      if (!isCompleted) {
        allCompleted = false;
      }
    }

    return {
      isEligible: allCompleted,
      requiredCourses
    };
  }

  /**
   * Update a course
   * @param courseId The course ID to update
   * @param updateCourseDto The data to update
   * @param userId The user ID making the update
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   * @param image Optional image file for the course
   */
  async update(
    courseId: string,
    updateCourseDto: any,
    userId: string,
    tenantId: string,
    organisationId: string,
    image?: Express.Multer.File,
  ): Promise<Course> {
    // Find the course with tenant/org filtering
    const course = await this.findOne(courseId, tenantId, organisationId);
    
    // Additional validation if both tenant and org IDs are provided
    if (tenantId && organisationId && (course.tenantId !== tenantId || course.organisationId !== organisationId)) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.COURSE_NOT_FOUND);
    }
    
    // If title is changed but no alias provided, generate one from the title
    if (updateCourseDto.title && updateCourseDto.title !== course.title && !updateCourseDto.alias) {
      updateCourseDto.alias = await HelperUtil.generateUniqueAliasWithRepo(
        updateCourseDto.title,
        this.courseRepository,
        tenantId,
        organisationId
      );
    }
    
    // Check for alias uniqueness if alias is being updated
    if (updateCourseDto.alias && updateCourseDto.alias !== course.alias) {
      const whereClause: any = {
        alias: updateCourseDto.alias,
        tenantId,
        courseId: Not(courseId),
        status: Not(CourseStatus.ARCHIVED),
      };
      
      if (organisationId) {
        whereClause.organisationId = organisationId;
      }
      
      const existingCourse = await this.courseRepository.findOne({
        where: whereClause as FindOptionsWhere<Course>,
      });
      
      // If the alias already exists, generate a new unique one
      if (existingCourse) {
        const originalAlias = updateCourseDto.alias;
        updateCourseDto.alias = await HelperUtil.generateUniqueAliasWithRepo(
          originalAlias,
          this.courseRepository,
          tenantId,
          organisationId
        );
        this.logger.log(`Alias '${originalAlias}' already exists. Generated new alias: ${updateCourseDto.alias}`);
      }
    }

    // Handle rewardType and templateId - handle boolean values for backward compatibility
    if (typeof updateCourseDto.rewardType === 'boolean') {
      updateCourseDto.rewardType = updateCourseDto.rewardType ? 'certificate' : null;
    }
    if (typeof updateCourseDto.templateId === 'boolean') {
      updateCourseDto.templateId = updateCourseDto.templateId ? HelperUtil.generateUuid() : null;
    }
    
    const updatedCourse = this.courseRepository.merge(course, {
      ...updateCourseDto,
      updatedBy: userId,
    });
    
    const savedCourse = await this.courseRepository.save(updatedCourse);
    
    // Cache the new course and invalidate related caches
    await Promise.all([
      this.cacheService.setCourse(savedCourse),
      this.cacheService.invalidateCourse(courseId, tenantId, organisationId),
    ]);
    return savedCourse;
  }

  /**
   * Remove a course (archive it)
   * @param courseId The course ID to remove
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async remove(
    courseId: string,
    userId: string,
    tenantId: string,
    organisationId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const course = await this.findOne(courseId, tenantId, organisationId);
      
      // Check if course has active enrollments
      const activeEnrollments = await this.userEnrollmentRepository.count({
        where: {
          courseId,
          tenantId,
          organisationId,
          status: EnrollmentStatus.PUBLISHED
        }
      });

      if (activeEnrollments > 0) {
        throw new BadRequestException(
          `Cannot delete course. Course has ${activeEnrollments} active enrollment(s). Please delete all enrollments first.`
        );
      }
      
      // Use a database transaction to ensure data consistency
      const result = await this.courseRepository.manager.transaction(async (transactionalEntityManager) => {
        // Archive all modules for this course in bulk
        const moduleArchiveResult = await transactionalEntityManager.update(
          Module,
          { 
            courseId,
            tenantId,
            organisationId,
            status: Not(ModuleStatus.ARCHIVED)
          },
          { 
            status: ModuleStatus.ARCHIVED,
            updatedBy: userId,
            updatedAt: new Date()
          }
        );

        // Archive all lessons for this course in bulk
        const lessonArchiveResult = await transactionalEntityManager.update(
          Lesson,
          { 
            courseId,
            tenantId,
            organisationId,
            status: Not(LessonStatus.ARCHIVED)
          },
          { 
            status: LessonStatus.ARCHIVED,
            updatedBy: userId,
            updatedAt: new Date()
          }
        );

        this.logger.log(`Archived ${moduleArchiveResult.affected || 0} modules and ${lessonArchiveResult.affected || 0} lessons for course ${courseId}`);

        // Archive the course
        course.status = CourseStatus.ARCHIVED;
        course.updatedBy = userId;
        course.updatedAt = new Date();
        await transactionalEntityManager.save(Course, course);

        return { moduleArchiveResult, lessonArchiveResult };
      });

      // Invalidate all related caches after successful transaction
      await this.cacheService.invalidateCourse(courseId, tenantId, organisationId);

      return { 
        success: true, 
        message: RESPONSE_MESSAGES.COURSE_DELETED || 'Course deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Error removing course: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Clone a course with all its modules, lessons, and media
   */
  async cloneCourse(
    courseId: string,
    userId: string,
    tenantId: string,
    organisationId: string,
    authorization: string,
    newCohortId?: string
  ): Promise<Course> {
    this.logger.log(`Cloneing course: ${courseId}`);

    try {
      // Use a database transaction to ensure data consistency
      const result = await this.courseRepository.manager.transaction(async (transactionalEntityManager) => {
        // Find the original course
        const originalCourse = await transactionalEntityManager.findOne(Course, {
          where: { 
            courseId,
            tenantId,
            organisationId,
          },
        });

        if (!originalCourse) {
          throw new NotFoundException(RESPONSE_MESSAGES.ERROR.COURSE_NOT_FOUND);
        }

        // Generate title and alias for the copied course
        const newTitle = `${originalCourse.title} (Copy)`;
        const newAlias = originalCourse.alias + '-copy';

        // Create the new course
        const newCourseData = {
          ...originalCourse,
          title: newTitle,
          alias: newAlias,
          status: CourseStatus.UNPUBLISHED,
          createdBy: userId,
          updatedBy: userId,
          // Remove properties that should not be copied
          courseId: undefined,
          params: newCohortId ? {
            ...originalCourse.params,
            cohortId: newCohortId
          } : originalCourse.params
        };

        this.logger.log(`Creating new course with title: ${newTitle}`);

        const newCourse = transactionalEntityManager.create(Course, newCourseData);
        const savedCourse = await transactionalEntityManager.save(Course, newCourse);
        const result = Array.isArray(savedCourse) ? savedCourse[0] : savedCourse;


        // Clone modules and their content
        await this.cloneModulesWithTransaction(
          originalCourse.courseId,
          result.courseId, 
          userId, 
          tenantId, 
          organisationId,
          transactionalEntityManager,
          authorization
        );

        this.logger.log(`Course copied successfully: ${result.courseId}`);
        return result;
      });

      // Handle cache operations after successful transaction
      await this.cacheService.invalidateCourse(courseId, tenantId, organisationId);

      return result;
    } catch (error) {
      this.logger.error(`Error cloning course ${courseId}: ${error.message}`, error.stack);
      
        throw error;
  }
  }

  /**
   * Clone modules for a course using transaction
   */
  private async cloneModulesWithTransaction(
    originalCourseId: string,
    newCourseId: string,
    userId: string,
    tenantId: string,
    organisationId: string,
    transactionalEntityManager: any,  
    authorization: string
  ): Promise<void> {
    try {
      // Get only top-level modules (parentId is null or undefined)
      const modules = await transactionalEntityManager.find(Module, {
        where: {
          courseId: originalCourseId,
          parentId: IsNull(), // Explicitly check for null parentId
          status: Not(ModuleStatus.ARCHIVED),
          tenantId,
          organisationId,
        },
        order: { ordering: 'ASC' },
      });

      if (!modules || modules.length === 0) {
        this.logger.warn(`No top-level modules found for course ${originalCourseId}`);
        return;
      }

      // Clone each module
      for (const module of modules) {
        try {
          await this.modulesService.cloneModuleWithTransaction(module, newCourseId, userId, tenantId, organisationId, transactionalEntityManager, authorization);
        } catch (error) {
          this.logger.error(`Error cloning module ${module.moduleId}: ${error.message}`);
          throw new Error(`${RESPONSE_MESSAGES.ERROR.MODULE_COPY_FAILED}: ${module.title}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error in cloneModulesWithTransaction: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update the entire course structure including module and lesson ordering
   * and moving lessons between modules
   */
  async updateCourseStructure(
    courseId: string,
    courseStructureDto: CourseStructureDto,
    userId: string,
    tenantId: string,
    organisationId: string
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Updating course structure for course ${courseId}: ${JSON.stringify(courseStructureDto)}`);

    try {
      // Use Repository Manager transaction approach
      const result = await this.courseRepository.manager.transaction(async (transactionalEntityManager) => {
        // Validate that course exists
        const course = await transactionalEntityManager.findOne(Course, {
          where: {
            courseId,
            status: Not(CourseStatus.ARCHIVED),
            tenantId,
            organisationId,
          },
        });

        if (!course) {
          throw new NotFoundException(RESPONSE_MESSAGES.ERROR.COURSE_NOT_FOUND);
        }

        // Check if any users have started tracking this course
        const courseTrackingCount = await transactionalEntityManager.count(CourseTrack, {
          where: {
            courseId,
            tenantId,
            organisationId,
          },
        });

        const hasCourseTracking = courseTrackingCount > 0;

        // Extract all module IDs and lesson IDs from the request
        const requestModuleIds = courseStructureDto.modules.map(m => m.moduleId);
        const requestLessonIds = courseStructureDto.modules
          .flatMap(m => m.lessons || [])
          .map(l => l.lessonId);

        // Get all existing modules and lessons for this course
        const existingModules = await transactionalEntityManager.find(Module, {
          where: {
            courseId,
            status: Not(ModuleStatus.ARCHIVED),
            tenantId,
            organisationId,
          },
          select: ['moduleId'],
        });

        const existingLessons = await transactionalEntityManager.find(Lesson, {
          where: {
            courseId,
            status: Not(LessonStatus.ARCHIVED),
            tenantId,
            organisationId,
          },
          select: ['lessonId'],
        });

        const existingModuleIds = existingModules.map(m => m.moduleId);
        const existingLessonIds = existingLessons.map(l => l.lessonId);

        // Validate that request contains all existing modules
        const missingModuleIds = existingModuleIds.filter(id => !requestModuleIds.includes(id));
        if (missingModuleIds.length > 0) {
          throw new BadRequestException(
            RESPONSE_MESSAGES.ERROR.MISSING_MODULES_IN_STRUCTURE(missingModuleIds.length, missingModuleIds.join(', '))
          );
        }

        // Validate that request contains all existing lessons
        const missingLessonIds = existingLessonIds.filter(id => !requestLessonIds.includes(id));
        if (missingLessonIds.length > 0) {
          throw new BadRequestException(
            RESPONSE_MESSAGES.ERROR.MISSING_LESSONS_IN_STRUCTURE(missingLessonIds.length, missingLessonIds.join(', '))
          );
        }

        // Validate that all modules in request exist and belong to the course
        const modules = await transactionalEntityManager.find(Module, {
          where: {
            moduleId: In(requestModuleIds),
            courseId,
            status: Not(ModuleStatus.ARCHIVED),
            tenantId,
            organisationId,
          },
        });

        if (modules.length !== requestModuleIds.length) {
          throw new BadRequestException(RESPONSE_MESSAGES.ERROR.SOME_MODULES_NOT_FOUND);
        }

        // Validate that all lessons in request exist
        if (requestLessonIds.length > 0) {
          const lessons = await transactionalEntityManager.find(Lesson, {
            where: {
              lessonId: In(requestLessonIds),
              courseId,
              tenantId,
              organisationId,
            },
          });

          if (lessons.length !== requestLessonIds.length) {
            throw new BadRequestException(RESPONSE_MESSAGES.ERROR.LESSONS_NOT_FOUND_IN_STRUCTURE);
          }

          // If course tracking has started, validate that lessons are not being moved between modules
          if (hasCourseTracking) {
            const currentLessons = await transactionalEntityManager.find(Lesson, {
              where: {
                courseId,
                tenantId,
                organisationId,
              },
              select: ['lessonId', 'moduleId'],
            });

            // Create a map of current lesson module assignments
            const currentLessonModuleMap = new Map(
              currentLessons.map(lesson => [lesson.lessonId, lesson.moduleId])
            );

            // Check if any lesson is being moved to a different module
            const lessonMovementDetected = courseStructureDto.modules
              .filter(m => m.lessons && m.lessons.length > 0)
              .some(moduleStructure => 
                moduleStructure.lessons!.some(lessonStructure => {
                  const currentModuleId = currentLessonModuleMap.get(lessonStructure.lessonId);
                  return currentModuleId && currentModuleId !== moduleStructure.moduleId;
                })
              );

            if (lessonMovementDetected) {
              throw new BadRequestException(RESPONSE_MESSAGES.ERROR.COURSE_TRACKING_STARTED_LESSON_MOVEMENT_NOT_ALLOWED);
            }

            this.logger.log(`Course tracking detected for course ${courseId}. Allowing only reordering within modules.`);
          }
        }

        // Update module ordering
        const moduleUpdatePromises = courseStructureDto.modules.map(moduleStructure => {
          return transactionalEntityManager.update(Module, 
            { moduleId: moduleStructure.moduleId }, 
            {
              ordering: moduleStructure.order,
              updatedBy: userId,
              updatedAt: new Date()
            }
          );
        });

        await Promise.all(moduleUpdatePromises);

        // Update lesson ordering and module assignments
        const lessonUpdatePromises = courseStructureDto.modules
          .filter(m => m.lessons && m.lessons.length > 0)
          .flatMap(moduleStructure => 
            moduleStructure.lessons!.map(lessonStructure => {
              return transactionalEntityManager.update(Lesson, 
                { lessonId: lessonStructure.lessonId }, 
                {
                  moduleId: moduleStructure.moduleId,
                  ordering: lessonStructure.order,
                  updatedBy: userId,
                  updatedAt: new Date()
                }
              );
            })
          );

        if (lessonUpdatePromises.length > 0) {
          await Promise.all(lessonUpdatePromises);
        }

        const operationType = hasCourseTracking ? 'reordering' : 'restructuring';
        this.logger.log(`Successfully ${operationType} course structure for course ${courseId} with ${modules.length} modules and ${requestLessonIds.length} lessons`);
        return { success: true, message: RESPONSE_MESSAGES.COURSE_STRUCTURE_UPDATED };
      });
     
      // Handle cache operations after successful transaction
      await this.cacheService.invalidateCourse(courseId, tenantId, organisationId);

      return result;
    } catch (error) {
      this.logger.error(`Error updating course structure for course ${courseId}: ${error.message}`, error.stack);
      
      // Re-throw the error with appropriate context
      if (error instanceof BadRequestException) {
        throw error;
      } else if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new BadRequestException(`${RESPONSE_MESSAGES.ERROR.INVALID_STRUCTURE_DATA}: ${error.message}`);
      }
    }
  }

  /**
   * Get next course, module or lesson based on ordering fields
   */
  async getNextCourseModuleLesson(
    nextIdFor: string,
    currentId: string,
    userId: string,
    tenantId: string,
    organisationId: string,
  ): Promise<{ success: boolean; data: { nextId: string; nextIdFor: string; hasNext: boolean } }> {
    try {
      this.logger.log(`Getting next ${nextIdFor} for ID: ${currentId}`);

      let nextId: string | null = null;
      let hasNext = false;

      switch (nextIdFor) {
        case 'course':
          const nextCourse = await this.getNextCourse(currentId, tenantId, organisationId);
          if (nextCourse) {
            nextId = nextCourse.courseId;
            hasNext = true;
          }
          break;

        case 'module':
          const nextModule = await this.getNextModule(currentId, tenantId, organisationId);
          if (nextModule) {
            nextId = nextModule.moduleId;
            hasNext = true;
          } else {
            // If no next module exists, try to get the next course from the current module's course
            const currentModule = await this.moduleRepository.findOne({
              where: { moduleId: currentId, tenantId, organisationId },
              select: ['courseId']
            });
            
            if (currentModule?.courseId) {
              const nextCourse = await this.getNextCourse(currentModule.courseId, tenantId, organisationId);
              if (nextCourse) {
                nextId = nextCourse.courseId;
                hasNext = true;
                // Update nextIdFor to indicate we're returning a course instead of module
                nextIdFor = 'course';
              }
            }
          }
          break;

        case 'lesson':
          const nextLesson = await this.getNextLesson(currentId, tenantId, organisationId);
          if (nextLesson) {
            nextId = nextLesson.lessonId;
            hasNext = true;
          } else {
            // If no next lesson exists, try to get the next module from the current lesson's module
            const currentLesson = await this.lessonRepository.findOne({
              where: { lessonId: currentId, tenantId, organisationId },
              select: ['moduleId', 'courseId']
            });
            
            if (currentLesson?.moduleId) {
              const nextModule = await this.getNextModule(currentLesson.moduleId, tenantId, organisationId);
              if (nextModule) {
                nextId = nextModule.moduleId;
                hasNext = true;
                // Update nextIdFor to indicate we're returning a module instead of lesson
                nextIdFor = 'module';
              } else {
                // If no next module exists, try to get the next course
                if (currentLesson.courseId) {
                  const nextCourse = await this.getNextCourse(currentLesson.courseId, tenantId, organisationId);
                  if (nextCourse) {
                    nextId = nextCourse.courseId;
                    hasNext = true;
                    // Update nextIdFor to indicate we're returning a course instead of lesson
                    nextIdFor = 'course';
                  }
                }
              }
            }
          }
          break;

        default:
          throw new BadRequestException(`Invalid nextIdFor: ${nextIdFor}`);
      }

      return {
        success: true,
        data: {
          nextId: nextId || '',
          nextIdFor,
          hasNext
        }
      };

    } catch (error) {
      this.logger.error(`Error getting next ${nextIdFor} for ID ${currentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get next course based on ordering and cohortId
   */
  private async getNextCourse(
    currentCourseId: string,
    tenantId: string,
    organisationId: string,
  ): Promise<Course | null> {
    // First get the current course to extract cohortId
    const currentCourse = await this.courseRepository.findOne({
      where: { courseId: currentCourseId, tenantId, organisationId },
      select: ['courseId', 'params', 'ordering']
    });

    if (!currentCourse) {
      throw new NotFoundException(`Course with ID ${currentCourseId} not found`);
    }

    const currentCohortId = currentCourse.params?.cohortId;
    const currentOrdering = currentCourse.ordering || 0;

    // Build query to find next course
    let query = this.courseRepository
      .createQueryBuilder('course')
      .select(['course.courseId', 'course.ordering'])
      .where('course.tenantId = :tenantId', { tenantId })
      .andWhere('course.organisationId = :organisationId', { organisationId })
      .andWhere('course.status = :status', { status: CourseStatus.PUBLISHED })
      .andWhere('course.ordering > :currentOrdering', { currentOrdering })
      .orderBy('course.ordering', 'ASC')
      .limit(1);

    // If cohortId exists, filter by it
    if (currentCohortId) {
      query = query.andWhere("course.params->>'cohortId' = :cohortId", { cohortId: currentCohortId });
    }

    return query.getOne();
  }

  /**
   * Get next module based on ordering within the same course
   * If no next module exists, returns null (caller should handle fallback to next course)
   */
  private async getNextModule(
    currentModuleId: string,
    tenantId: string,
    organisationId: string,
  ): Promise<Module | null> {
    // First get the current module to find its course and ordering
    const currentModule = await this.moduleRepository.findOne({
      where: { moduleId: currentModuleId, tenantId, organisationId },
      select: ['moduleId', 'courseId', 'ordering']
    });

    if (!currentModule) {
      throw new NotFoundException(`Module with ID ${currentModuleId} not found`);
    }

    // Find next module in the same course
    return this.moduleRepository
      .createQueryBuilder('module')
      .select(['module.moduleId', 'module.ordering'])
      .where('module.courseId = :courseId', { courseId: currentModule.courseId })
      .andWhere('module.tenantId = :tenantId', { tenantId })
      .andWhere('module.organisationId = :organisationId', { organisationId })
      .andWhere('module.status = :status', { status: ModuleStatus.PUBLISHED })
      .andWhere('module.ordering > :currentOrdering', { currentOrdering: currentModule.ordering || 0 })
      .orderBy('module.ordering', 'ASC')
      .limit(1)
      .getOne();
  }

  /**
   * Get next lesson based on ordering within the same module
   */
  private async getNextLesson(
    currentLessonId: string,
    tenantId: string,
    organisationId: string,
  ): Promise<Lesson | null> {
    // First get the current lesson to find its module and ordering
    const currentLesson = await this.lessonRepository.findOne({
      where: { lessonId: currentLessonId, tenantId, organisationId },
      select: ['lessonId', 'moduleId', 'ordering']
    });

    if (!currentLesson) {
      throw new NotFoundException(`Lesson with ID ${currentLessonId} not found`);
    }
    
    // Find next lesson in the same module
    return this.lessonRepository
      .createQueryBuilder('lesson')
      .select(['lesson.lessonId', 'lesson.ordering'])
      .where('lesson.moduleId = :moduleId', { moduleId: currentLesson.moduleId })
      .andWhere('lesson.tenantId = :tenantId', { tenantId })
      .andWhere('lesson.organisationId = :organisationId', { organisationId })
      .andWhere('lesson.status = :status', { status: LessonStatus.PUBLISHED })
      .andWhere('lesson.ordering > :currentOrdering', { currentOrdering: currentLesson.ordering || 0 })
      .orderBy('lesson.ordering', 'ASC')
      .limit(1)
      .getOne();
  }
}