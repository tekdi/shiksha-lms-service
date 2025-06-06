import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Not, Equal, ILike, IsNull } from 'typeorm';
import { Course, CourseStatus } from './entities/course.entity';
import { Module, ModuleStatus } from '../modules/entities/module.entity';
import { Lesson, LessonStatus } from '../lessons/entities/lesson.entity';
import { CourseTrack, TrackingStatus } from '../tracking/entities/course-track.entity';
import { LessonTrack } from '../tracking/entities/lesson-track.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { HelperUtil } from '../common/utils/helper.util';
import { CreateCourseDto } from './dto/create-course.dto';
import { SearchCourseDto } from './dto/search-course.dto';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);
  private readonly cache_ttl_default: number;
  private readonly cache_ttl_user: number;
  private readonly cache_prefix_course: string;
  private readonly cache_prefix_module: string;
  private readonly cache_prefix_lesson: string;
  private readonly cache_enabled: boolean;

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
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {
    this.cache_enabled = this.configService.get('CACHE_ENABLED') === true;
    this.cache_ttl_default = parseInt(this.configService.get('CACHE_TTL_DEFAULT') || '3600', 10);
    this.cache_ttl_user = this.configService.get('CACHE_USER_TTL') || 600;
    this.cache_prefix_course = this.configService.get('CACHE_COURSE_PREFIX') || 'course';
    this.cache_prefix_module = this.configService.get('CACHE_MODULE_PREFIX') || 'module';
    this.cache_prefix_lesson = this.configService.get('CACHE_LESSON_PREFIX') || 'lesson';
  }

  /**
   * Create a new course
   */
  async create(
    createCourseDto: CreateCourseDto,
    userId: string,
    tenantId: string,
    organisationId?: string,
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
      certificateId: createCourseDto.certificateId,
      tenantId,
      organisationId,
      createdBy: userId,
      updatedBy: userId,
    };
    
    const course = this.courseRepository.create(courseData);
    const savedCourse = await this.courseRepository.save(course);
    const result = Array.isArray(savedCourse) ? savedCourse[0] : savedCourse;
    
    if (this.cache_enabled) {
      // Invalidate and set new cache values
      const entityCacheKey = `${this.cache_prefix_course}:${result.courseId}:${tenantId}:${organisationId}`;
      const searchCacheKey = `${this.cache_prefix_course}:search:${tenantId}:${organisationId}`;
      const hierarchyCacheKey = `${this.cache_prefix_course}:hierarchy:${result.courseId}:${tenantId}:${organisationId}`;

      // Invalidate existing caches
      await Promise.all([
        this.cacheService.del(searchCacheKey),
        this.cacheService.del(hierarchyCacheKey),
        this.cacheService.set(entityCacheKey, result, this.cache_ttl_default),
         ]);
       }
    
    return result;
  }

  /**
   * Search courses with filters and keyword search
   */
  async search(
    filters: Omit<SearchCourseDto, keyof PaginationDto>,
    paginationDto: PaginationDto,
    tenantId: string,
    organisationId?: string,
  ): Promise<{ items: Course[]; total: number }> {
    const { page = 1, limit = 10 } = paginationDto;
    const cacheKey = `${this.cache_prefix_course}:search:${tenantId}:${organisationId}`;

      if (this.cache_enabled) {
        // Try to get from cache first
        const cachedResult = await this.cacheService.get<{ items: Course[]; total: number }>(cacheKey);
        if (cachedResult) {
          return cachedResult;
        }
      }

    const skip = (page - 1) * limit;

    const whereClause: any = { 
      tenantId,
      ...(organisationId && { organisationId }), // Add organisationId for data isolation if it exists
      status: filters?.status || Not(CourseStatus.ARCHIVED),
    };

    // Add boolean filters if provided
    if (filters?.featured !== undefined) {
      whereClause.featured = filters.featured;
    }
    if (filters?.free !== undefined) {
      whereClause.free = filters.free;
    }
    if (filters?.createdBy) {
      whereClause.createdBy = filters.createdBy;
    }

    // Add date range filters for start date
    if (filters?.startDateFrom || filters?.startDateTo) {
      whereClause.startDatetime = {};
      if (filters.startDateFrom) {
        whereClause.startDatetime.gte = filters.startDateFrom;
      }
      if (filters.startDateTo) {
        whereClause.startDatetime.lte = filters.startDateTo;
      }
    }

    // Add date range filters for end date
    if (filters?.endDateFrom || filters?.endDateTo) {
      whereClause.endDatetime = {};
      if (filters.endDateFrom) {
        whereClause.endDatetime.gte = filters.endDateFrom;
      }
      if (filters.endDateTo) {
        whereClause.endDatetime.lte = filters.endDateTo;
      }
    }

    // If there's a search query, search in title and description
    if (filters?.query) {
      return this.courseRepository.findAndCount({
        where: [
          { 
            title: ILike(`%${filters.query}%`),
            ...whereClause
          },
          { 
            description: ILike(`%${filters.query}%`),
            ...whereClause
          },
          {
            shortDescription: ILike(`%${filters.query}%`),
            ...whereClause
          }
        ],
        order: { createdAt: 'DESC' },
        take: limit,
        skip,
      }).then(([items, total]) => ({ items, total }));
    }

    // If no search query, just use filters
    const result = await this.courseRepository.findAndCount({
      where: whereClause,
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    }).then(([items, total]) => ({ items, total }));

    // Cache the result
    if (this.cache_enabled) {
      await this.cacheService.set(cacheKey, result,  this.cache_ttl_default);
    }

    return result;
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
    tenantId?: string, 
    organisationId?: string
  ): Promise<Course> {
    const cacheKey = `${this.cache_prefix_course}:${courseId}:${tenantId}:${organisationId}`;
    
    if (this.cache_enabled) {
      const cachedCourse = await this.cacheService.get<Course>(cacheKey);
      if (cachedCourse) {
        return cachedCourse;
      }
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

    // Cache the course if caching is enabled
    if (this.cache_enabled) {
      await this.cacheService.set(cacheKey, course, this.cache_ttl_default);
    }

    return course;
  }

  /**
   * Find course hierarchy (with modules and lessons)
   * @param courseId The course ID to find
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async findCourseHierarchy(
    courseId: string,
    tenantId?: string,
    organisationId?: string
  ): Promise<any> {
    const cacheKey = `${this.cache_prefix_course}:hierarchy:${courseId}:${tenantId}:${organisationId}`;
    
    if (this.cache_enabled) {
      const cachedHierarchy = await this.cacheService.get<any>(cacheKey);
      if (cachedHierarchy) {
        return cachedHierarchy;
      }
    }

    // Find the course with tenant/org filtering
    const course = await this.findOne(courseId, tenantId, organisationId);
    
    // For data isolation, ensure we filter modules by tenantId as well
    const moduleWhereClause: any = { 
      courseId,
      parentId: IsNull(),
      status: Not(ModuleStatus.ARCHIVED as any),
    };
    
    // Apply tenant and organization filters if they exist
    if (tenantId) {
      moduleWhereClause.tenantId = tenantId;
    }
    
    if (organisationId) {
      moduleWhereClause.organisationId = organisationId;
    }
    
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
          order: { idealTime: 'ASC' },
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
              order: { idealTime: 'ASC' },
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

    // Cache the result if caching is enabled
    if (this.cache_enabled) {
      await this.cacheService.set(cacheKey, result, this.cache_ttl_default);
    }

    return result;
  }

  /**
   * Find course hierarchy with tracking information
   * @param courseId The course ID to find
   * @param userId The user ID for tracking data
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async findCourseHierarchyWithTracking(
    courseId: string, 
    userId: string,
    tenantId?: string,
    organisationId?: string
  ): Promise<any> {
    
    // Get the basic course hierarchy first with proper filtering
    const courseHierarchy = await this.findCourseHierarchy(courseId, tenantId, organisationId);
    
    
    // Find course tracking data for this user with tenant/org filtering
    const trackingWhereClause: any = { 
      courseId, 
      userId,
    };
    
    // Apply tenant and organization filters if they exist
    if (tenantId) {
      trackingWhereClause.tenantId = tenantId;
    }
    
    if (organisationId) {
      trackingWhereClause.organisationId = organisationId;
    }
    
    let courseTracking = await this.courseTrackRepository.findOne({
      where: trackingWhereClause
    });

    

    // If there's no course tracking yet, return with default "not started" status
    if (!courseTracking) {
      return {
        ...courseHierarchy,
        tracking: {
          status: 'NOT_STARTED',
          progress: 0,
          completedLessons: 0,
          totalLessons: courseHierarchy.modules.reduce((total, module) => total + module.lessons.length, 0),
          lastAccessed: null,
          timeSpent: 0,
          startDatetime: null,
          endDatetime: null,
          noOfLessons: courseHierarchy.modules.reduce((total, module) => total + module.lessons.length, 0)
        },
        lastAccessedLesson: null
      };
    }

    // Get all lesson tracks for this user and course with tenant/org filtering
    const lessonTrackWhereClause: any = {
      userId,
      courseId,
      tenantId,
      organisationId
    };
        
    const lessonTracks = await this.lessonTrackRepository.find({
      where: lessonTrackWhereClause,
      order: { updatedAt: 'DESC', attempt: 'DESC' }, // Order by last access time
    });

    console.log(lessonTracks);

    // Create a map of lesson IDs to their last attempt tracking data
    const lessonTrackMap = new Map();
    lessonTracks.forEach(track => {
      // Only store the last attempt for each lesson
      if (!lessonTrackMap.has(track.lessonId)) {
        lessonTrackMap.set(track.lessonId, track);
      }
    });

    // Calculate total time spent across all lesson tracks
    const totalTimeSpent = lessonTracks.reduce((sum, track) => sum + (track.timeSpent || 0), 0);

    let lastAccessedLesson: any = null;
    //if coursetracking is completed, then lastaccessedlesson should be null
    if (courseTracking.status === TrackingStatus.COMPLETED) {
      lastAccessedLesson = null;
    }else{
      // Get the last accessed lesson details
      lastAccessedLesson = lessonTracks.length > 0 ? {
      lessonId: lessonTracks[0].lessonId,
      attempt: {
        attemptId: lessonTracks[0].lessonTrackId,
        attemptNumber: lessonTracks[0].attempt,
        status: lessonTracks[0].status,
        startDatetime: lessonTracks[0].startDatetime,
        endDatetime: lessonTracks[0].endDatetime,
        score: lessonTracks[0].score,
        progress: lessonTracks[0].status === TrackingStatus.COMPLETED ? 100 : 
                 (lessonTracks[0].status === TrackingStatus.STARTED ? 0 : 
                 Math.min(Math.round((lessonTracks[0].currentPosition || 0) * 100), 99)),
        timeSpent: lessonTracks[0].timeSpent || 0,
        lastAccessed: lessonTracks[0].updatedAt,
        totalContent: lessonTracks[0].totalContent || 0,
          currentPosition: lessonTracks[0].currentPosition || 0
        }
      } : null;
    }

    // Process modules to add tracking data
    const modulesWithTracking = courseHierarchy.modules.map(module => {
      // Process lessons in this module
      const lessonsWithTracking = module.lessons.map(lesson => {
        const lessonTrack = lessonTrackMap.get(lesson.lessonId);
        return {
          ...lesson,
          tracking: lessonTrack ? {
            status: lessonTrack.status,
            progress: lessonTrack.status === TrackingStatus.COMPLETED ? 100 : 
                     (lessonTrack.status === TrackingStatus.STARTED ? 0 : 
                     Math.min(Math.round((lessonTrack.currentPosition || 0) * 100), 99)),
            lastAccessed: lessonTrack.updatedAt,
            timeSpent: lessonTrack.timeSpent || 0,
            score: lessonTrack.score,
            attempt: {
              attemptId: lessonTrack.lessonTrackId,
              attemptNumber: lessonTrack.attempt,
              startDatetime: lessonTrack.startDatetime,
              endDatetime: lessonTrack.endDatetime,
              totalContent: lessonTrack.totalContent || 0,
              currentPosition: lessonTrack.currentPosition || 0
            }
          } : {
            status: 'NOT_STARTED',
            progress: 0,
            lastAccessed: null,
            timeSpent: 0,
            score: null,
            attempt: null
          }
        };
      });

      // Calculate module progress from lesson progress
      const completedLessons = lessonsWithTracking.filter(
        l => l.tracking?.status === TrackingStatus.COMPLETED
      ).length;
      
      const totalLessons = lessonsWithTracking.length;
      
      const moduleProgress = totalLessons > 0 
        ? Math.round((completedLessons / totalLessons) * 100) 
        : 0;
      
      const moduleStatus = moduleProgress === 100 
        ? TrackingStatus.COMPLETED 
        : (moduleProgress > 0 ? TrackingStatus.INCOMPLETE : TrackingStatus.STARTED);

      // Process submodules similarly
      const submodulesWithTracking = module.submodules.map(submodule => {
        const submoduleLessonsWithTracking = submodule.lessons.map(lesson => {
          const lessonTrack = lessonTrackMap.get(lesson.lessonId);
          return {
            ...lesson,
            tracking: lessonTrack ? {
              status: lessonTrack.status,
              progress: lessonTrack.status === TrackingStatus.COMPLETED ? 100 : 
                        (lessonTrack.status === TrackingStatus.STARTED ? 0 : 
                        Math.min(Math.round((lessonTrack.currentPosition || 0) * 100), 99)),
              lastAccessed: lessonTrack.updatedAt,
              timeSpent: lessonTrack.timeSpent || 0,
              score: lessonTrack.score,
              attempt: {
                attemptId: lessonTrack.lessonTrackId,
                attemptNumber: lessonTrack.attempt,
                startDatetime: lessonTrack.startDatetime,
                endDatetime: lessonTrack.endDatetime,
                totalContent: lessonTrack.totalContent || 0,
                currentPosition: lessonTrack.currentPosition || 0
              }
            } : {
              status: 'NOT_STARTED',
              progress: 0,
              lastAccessed: null,
              timeSpent: 0,
              score: null,
              attempt: null
            }
          };
        });

        // Calculate submodule progress
        const subCompletedLessons = submoduleLessonsWithTracking.filter(
          l => l.tracking?.status === TrackingStatus.COMPLETED
        ).length;
        
        const subTotalLessons = submoduleLessonsWithTracking.length;
        
        const submoduleProgress = subTotalLessons > 0 
          ? Math.round((subCompletedLessons / subTotalLessons) * 100) 
          : 0;
        
        const submoduleStatus = submoduleProgress === 100 
          ? TrackingStatus.COMPLETED 
          : (submoduleProgress > 0 ? TrackingStatus.INCOMPLETE : TrackingStatus.STARTED);

        return {
          ...submodule,
          lessons: submoduleLessonsWithTracking,
          tracking: {
            status: submoduleStatus,
            progress: submoduleProgress,
            completedLessons: subCompletedLessons,
            totalLessons: subTotalLessons,
            lastAccessed: submoduleLessonsWithTracking.length > 0 
              ? this.findMostRecentAccess(submoduleLessonsWithTracking) 
              : null
          }
        };
      });

      return {
        ...module,
        lessons: lessonsWithTracking,
        submodules: submodulesWithTracking,
        tracking: {
          status: moduleStatus,
          progress: moduleProgress,
          completedLessons: completedLessons,
          totalLessons: totalLessons,
          lastAccessed: lessonsWithTracking.length > 0 
            ? this.findMostRecentAccess(lessonsWithTracking) 
            : null
        }
      };
    });

    // Return the complete hierarchy with tracking information
    const result = {
      ...courseHierarchy,
      modules: modulesWithTracking,
      tracking: {
        status: courseTracking.status,
        progress: courseTracking.completedLessons / (courseTracking.noOfLessons || await this.countTotalLessons(courseId, tenantId, organisationId)) * 100,
        completedLessons: courseTracking.completedLessons,
        totalLessons: courseTracking.noOfLessons || await this.countTotalLessons(courseId, tenantId, organisationId),
        lastAccessed: courseTracking.lastAccessedDate,
        timeSpent: totalTimeSpent,
        startDatetime: courseTracking.startDatetime,
        endDatetime: courseTracking.endDatetime,
      },
      lastAccessedLesson
    };
    return result;
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
    organisationId?: string,
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

    // Handle certificateId - handle boolean values
    if (typeof updateCourseDto.certificateId === 'boolean') {
      updateCourseDto.certificateId = updateCourseDto.certificateId ? HelperUtil.generateUuid() : null;
    }
    
    const updatedCourse = this.courseRepository.merge(course, {
      ...updateCourseDto,
      updatedBy: userId,
    });
    
    const savedCourse = await this.courseRepository.save(updatedCourse);
    
    if (this.cache_enabled) { 
      // Invalidate and set new cache values
      const entityCacheKey = `${this.cache_prefix_course}:${courseId}:${tenantId}:${organisationId}`;
      const searchCacheKey = `${this.cache_prefix_course}:search:${tenantId}:${organisationId}`;
      const hierarchyCacheKey = `${this.cache_prefix_course}:hierarchy:${courseId}:${tenantId}:${organisationId}`;
      const moduleCacheKey = `${this.cache_prefix_module}:course:${courseId}:${tenantId}:${organisationId}`;
      const lessonCacheKey = `${this.cache_prefix_lesson}:course:${courseId}:${tenantId}:${organisationId}`;
      
      // Invalidate existing caches
      await Promise.all([
        this.cacheService.del(entityCacheKey),
        this.cacheService.del(searchCacheKey),
        this.cacheService.del(hierarchyCacheKey),
        this.cacheService.del(moduleCacheKey),
        this.cacheService.del(lessonCacheKey)
      ]);
    }
    
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
    tenantId?: string,
    organisationId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const course = await this.findOne(courseId, tenantId, organisationId);
      course.status = CourseStatus.ARCHIVED;
      course.updatedBy = userId;
      course.updatedAt = new Date();
      const savedCourse = await this.courseRepository.save(course);

      // Invalidate and set new cache values
      if (this.cache_enabled) {
        const courseCacheKey = `${this.cache_prefix_course}:${courseId}:${tenantId}:${organisationId}`;
        const moduleCacheKey = `${this.cache_prefix_module}:course:${courseId}:${tenantId}:${organisationId}`;
        const lessonCacheKey = `${this.cache_prefix_lesson}:course:${courseId}:${tenantId}:${organisationId}`;
        const hierarchyCacheKey = `${this.cache_prefix_course}:hierarchy:${courseId}:${tenantId}:${organisationId}`;
        const searchCacheKey = `${this.cache_prefix_course}:search:${tenantId}:${organisationId}`;

        // Invalidate existing caches
        await Promise.all([
          this.cacheService.del(courseCacheKey),
          this.cacheService.del(moduleCacheKey),
          this.cacheService.del(lessonCacheKey),
          this.cacheService.del(hierarchyCacheKey),
          this.cacheService.del(searchCacheKey)
        ]);
      }

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
   * Count total lessons in a course using direct lesson table relationship
   * @param courseId The course ID to count lessons for
   * @param tenantId Optional tenant ID for data isolation
   * @param organisationId Optional organization ID for data isolation
   */
  private async countTotalLessons(
    courseId: string,
    tenantId?: string,
    organisationId?: string
  ): Promise<number> {
    const whereClause: any = {
      courseId,
      status: Not(LessonStatus.ARCHIVED)
    };

    // Add tenant and organization filters if they exist
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }
    
    if (organisationId) {
      whereClause.organisationId = organisationId;
    }

    return this.lessonRepository.count({
      where: whereClause
    });
  }

}