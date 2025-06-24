import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Not, Equal, ILike, IsNull, Like, In } from 'typeorm';
import { Course, CourseStatus } from './entities/course.entity';
import { Module, ModuleStatus } from '../modules/entities/module.entity';
import { Lesson, LessonStatus } from '../lessons/entities/lesson.entity';
import { CourseTrack, TrackingStatus } from '../tracking/entities/course-track.entity';
import { LessonTrack } from '../tracking/entities/lesson-track.entity';
import { ModuleTrack } from '../tracking/entities/module-track.entity';
import { Media } from '../media/entities/media.entity';
import { AssociatedFile } from '../media/entities/associated-file.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { API_IDS } from '../common/constants/api-ids.constant';
import { HelperUtil } from '../common/utils/helper.util';
import { CreateCourseDto } from './dto/create-course.dto';
import { SearchCourseDto } from './dto/search-course.dto';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { CourseStructureDto } from '../courses/dto/course-structure.dto';
import { CacheConfigService } from '../cache/cache-config.service';

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
    private readonly cacheService: CacheService,
    private readonly cacheConfig: CacheConfigService,
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
    filters: Omit<SearchCourseDto, keyof PaginationDto>,
    paginationDto: PaginationDto,
    tenantId: string,
    organisationId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ courses: Course[]; total: number }> {
    // Generate cache key with all filter parameters
    const cacheKey = this.cacheConfig.getCourseSearchKey(
      tenantId,
      organisationId,
      filters,
      paginationDto.page,
      paginationDto.limit
    );
    
    // Check cache first
    const cachedResult = await this.cacheService.get<{ courses: Course[]; total: number }>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const skip = (page - 1) * limit;

    const whereClause: any = { 
      tenantId,
      organisationId,
      status: filters?.status || Not(CourseStatus.ARCHIVED),
    };

    // Add cohort filter if provided, cohortid will be at params in json format
    if (filters?.cohortId) {
      whereClause.params = {
        ...whereClause.params,
        cohortId: filters.cohortId
      };
    }

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

    let result: { courses: Course[]; total: number };

    // If there's a search query, search in title and description
    if (filters?.query) {
      result = await this.courseRepository.findAndCount({
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
      }).then(([items, total]) => ({ courses: items, total }));
    } else {
      // If no search query, just use filters
      result = await this.courseRepository.findAndCount({
        where: whereClause,
        order: { createdAt: 'DESC' },
        take: limit,
        skip,
      }).then(([items, total]) => ({ courses: items, total }));
    }

    // Set in cache with TTL
    await this.cacheService.set(cacheKey, result, this.cacheConfig.COURSE_TTL);

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
   */
  async findCourseHierarchyWithTracking(
    courseId: string, 
    userId: string,
    tenantId: string,
    organisationId: string
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

    // Get all module tracks for this user and course with tenant/org filtering
    const moduleTrackWhereClause: any = {
      userId,
      tenantId,
      organisationId
    };

    const moduleTracks = await this.moduleTrackRepository.find({
      where: moduleTrackWhereClause,
    });

    // Create a map of lesson IDs to their last attempt tracking data
    const lessonTrackMap = new Map();
    lessonTracks.forEach(track => {
      // Only store the last attempt for each lesson
      if (!lessonTrackMap.has(track.lessonId)) {
        lessonTrackMap.set(track.lessonId, track);
      }
    });

    // Create a map of module IDs to their tracking data
    const moduleTrackMap = new Map();
    moduleTracks.forEach(track => {
      moduleTrackMap.set(track.moduleId, track);
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
                      Math.min(Math.round(((lessonTrack.totalContent > 0 ? lessonTrack.currentPosition/lessonTrack.totalContent : 0)) * 100), 99)),
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

      // Get module tracking data
      const moduleTrack = moduleTrackMap.get(module.moduleId);

      // Calculate module progress from lesson progress
      const completedLessons = lessonsWithTracking.filter(
        l => l.tracking?.status === TrackingStatus.COMPLETED
      ).length;

      const incompleteLessons = lessonsWithTracking.filter(
        l => l.tracking?.status === TrackingStatus.INCOMPLETE
      ).length;
      
      const totalLessons = lessonsWithTracking.length;
      
      const moduleProgress = totalLessons > 0 
        ? Math.round((completedLessons / totalLessons) * 100) 
        : 0;

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

        // Get submodule tracking data
        const submoduleTrack = moduleTrackMap.get(submodule.moduleId);

        // Calculate submodule progress from lesson progress
        const subCompletedLessons = submoduleLessonsWithTracking.filter(
          l => l.tracking?.status === TrackingStatus.COMPLETED
        ).length;
        
        const subTotalLessons = submoduleLessonsWithTracking.length;
        
        const submoduleProgress = subTotalLessons > 0 
          ? Math.round((subCompletedLessons / subTotalLessons) * 100) 
          : 0;

        return {
          ...submodule,
          lessons: submoduleLessonsWithTracking,
          tracking: submoduleTrack ? {
            status: submoduleTrack.status,
            progress: submoduleProgress,
            completedLessons: subCompletedLessons,
            totalLessons: subTotalLessons,
            lastAccessed: null // Module track doesn't have lastAccessed field
          } : {
            status: 'NOT_STARTED',
            progress: 0,
            completedLessons: 0,
            totalLessons: subTotalLessons,
            lastAccessed: null
          }
        };
      });

      return {
        ...module,
        lessons: lessonsWithTracking,
        submodules: submodulesWithTracking,
        tracking: moduleTrack ? {
          status: moduleTrack.status,
          progress: moduleProgress,
          completedLessons: completedLessons,
          totalLessons: totalLessons,
          lastAccessed: null // Module track doesn't have lastAccessed field
        } : {
          status: 'NOT_STARTED',
          progress: 0,
          completedLessons: 0,
          totalLessons: totalLessons,
          lastAccessed: null
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

    // Handle certificateId - handle boolean values
    if (typeof updateCourseDto.certificateId === 'boolean') {
      updateCourseDto.certificateId = updateCourseDto.certificateId ? HelperUtil.generateUuid() : null;
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
      course.status = CourseStatus.ARCHIVED;
      course.updatedBy = userId;
      course.updatedAt = new Date();
      const savedCourse = await this.courseRepository.save(course);

       // Cache the new course and invalidate related caches
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

  /**
   * Clone a course with all its modules, lessons, and media
   */
  async cloneCourse(
    courseId: string,
    userId: string,
    tenantId: string,
    organisationId: string,
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
          transactionalEntityManager
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
          await this.cloneModuleWithTransaction(module, newCourseId, userId, tenantId, organisationId, transactionalEntityManager);
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
   * Clone a single module with its lessons using transaction
   */
  private async cloneModuleWithTransaction(
    originalModule: Module,
    newCourseId: string,
    userId: string,
    tenantId: string,
    organisationId: string,
    transactionalEntityManager: any,
  ): Promise<Module | null> {
    try {
      // Create new module data
      const newModuleData = {
        ...originalModule,
        courseId: newCourseId,
        parentId: undefined,
        createdBy: userId,
        updatedBy: userId,
        // Remove properties that should not be copied
        moduleId: undefined,
      };

      const newModule = transactionalEntityManager.create(Module, newModuleData);
      const savedModule = await transactionalEntityManager.save(Module, newModule);

      if (!savedModule) {
        throw new Error(`${RESPONSE_MESSAGES.ERROR.MODULE_SAVE_FAILED}: ${originalModule.title}`);
      }

      // Clone lessons for this module
      await this.cloneLessonsWithTransaction(originalModule.moduleId, savedModule.moduleId, userId, tenantId, organisationId, transactionalEntityManager, newCourseId);

      // Clone submodules if any
      const submodules = await transactionalEntityManager.find(Module, {
        where: {
          parentId: originalModule.moduleId,
          status: Not(ModuleStatus.ARCHIVED),
          tenantId,
          organisationId,
        },
        order: { ordering: 'ASC' },
      });
       if (!submodules || submodules.length === 0) {
        this.logger.warn(`No submodules found for module ${originalModule.moduleId}`);
        return null;
      }


      for (const submodule of submodules) {
        try {
          await this.cloneSubmoduleWithTransaction(submodule, savedModule.moduleId, userId, tenantId, organisationId, transactionalEntityManager, newCourseId);
        } catch (error) {
          this.logger.error(`Error cloning submodule ${submodule.moduleId}: ${error.message}`);
          throw new Error(`${RESPONSE_MESSAGES.ERROR.SUBMODULE_COPY_FAILED}: ${submodule.title}`);
        }
      }

      return savedModule;
    } catch (error) {
      this.logger.error(`Error in cloneModuleWithTransaction for module ${originalModule.moduleId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clone a submodule using transaction
   */
  private async cloneSubmoduleWithTransaction(
    originalSubmodule: Module,
    newParentId: string,
    userId: string,
    tenantId: string,
    organisationId: string,
    transactionalEntityManager: any,
    newCourseId: string,
  ): Promise<Module> {
  try {
    // Create new submodule data
    const newSubmoduleData = {
      ...originalSubmodule,
      courseId: newCourseId,
      parentId: newParentId,
      createdBy: userId,
      updatedBy: userId,
      // Remove properties that should not be copied
      moduleId: undefined,
    };

    const newSubmodule = transactionalEntityManager.create(Module, newSubmoduleData);
    const savedSubmodule = await transactionalEntityManager.save(Module, newSubmodule);

    // Clone lessons for this submodule
    await this.cloneLessonsWithTransaction(originalSubmodule.moduleId, savedSubmodule.moduleId, userId, tenantId, organisationId, transactionalEntityManager, newCourseId);

    return savedSubmodule;
    } catch (error) {
      this.logger.error(`Error in cloneSubmoduleWithTransaction for submodule ${originalSubmodule.moduleId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clone lessons for a module using transaction
   */
  private async cloneLessonsWithTransaction(
    originalModuleId: string,
    newModuleId: string,
    userId: string,
    tenantId: string,
    organisationId: string,
    transactionalEntityManager: any,
    newCourseId: string,
  ): Promise<void> {
    try {
      // Get all lessons for the original module
      const lessons = await transactionalEntityManager.find(Lesson, {
        where: {
          moduleId: originalModuleId,
          status: Not(LessonStatus.ARCHIVED),
          tenantId,
          organisationId,
        },
        relations: ['media', 'associatedFiles.media'],
      });

      if (!lessons || lessons.length === 0) {
        this.logger.warn(`No lessons found for module ${originalModuleId}`);
        return;
      }

      // Clone each lesson
      for (const lesson of lessons) {
        try {
          await this.cloneLessonWithTransaction(lesson, newModuleId, userId, tenantId, organisationId, transactionalEntityManager, newCourseId);
        } catch (error) {
          this.logger.error(`Error cloning lesson ${lesson.lessonId}: ${error.message}`);
          throw new Error(`${RESPONSE_MESSAGES.ERROR.LESSON_COPY_FAILED}: ${lesson.title}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error in cloneLessonsWithTransaction for module ${originalModuleId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clone a single lesson with its media using transaction
   */
  private async cloneLessonWithTransaction(
    originalLesson: Lesson,
    newModuleId: string,
    userId: string,
    tenantId: string,
    organisationId: string,
    transactionalEntityManager: any,
    newCourseId: string,
  ): Promise<Lesson> {
    try {
      let newMediaId: string | undefined;

      // Clone media if lesson has media
      if (originalLesson.mediaId) {
        const originalMedia = await transactionalEntityManager.findOne(Media, {
          where: { mediaId: originalLesson.mediaId },
        });

        if (originalMedia) {
          const newMediaData = {
            ...originalMedia,
            createdBy: userId,
            updatedBy: userId,
            // Remove properties that should not be copied
            mediaId: undefined,
            // Don't set createdAt/updatedAt - let TypeORM handle them automatically
          };

          const newMedia = transactionalEntityManager.create(Media, newMediaData);
          const savedMedia = await transactionalEntityManager.save(Media, newMedia);
          
          if (!savedMedia) {
            throw new Error(`${RESPONSE_MESSAGES.ERROR.MEDIA_SAVE_FAILED}: ${originalLesson.title}`);
          }
          
          newMediaId = savedMedia.mediaId;
        }
      }
     

      this.logger.log(`Final newMediaId value: ${newMediaId}`);

      // Create new lesson data
      const newLessonData = {
        // Copy all properties from original lesson except the ones we want to override
        title: originalLesson.title,
        alias: originalLesson.alias + '-copy',
        format: originalLesson.format,
        image: originalLesson.image,
        description: originalLesson.description,
        status: originalLesson.status,
        startDatetime: originalLesson.startDatetime,
        endDatetime: originalLesson.endDatetime,
        storage: originalLesson.storage,
        noOfAttempts: originalLesson.noOfAttempts,
        attemptsGrade: originalLesson.attemptsGrade,
        eligibilityCriteria: originalLesson.eligibilityCriteria,
        idealTime: originalLesson.idealTime,
        resume: originalLesson.resume,
        totalMarks: originalLesson.totalMarks,
        passingMarks: originalLesson.passingMarks,
        params: originalLesson.params || {},
        sampleLesson: originalLesson.sampleLesson,
        considerForPassing: originalLesson.considerForPassing,
        tenantId,
        organisationId,
        // Override with new values
        mediaId: newMediaId || null, //Use null if no new media was created
        courseId: newCourseId,
        moduleId: newModuleId,
        createdBy: userId,
        updatedBy: userId,
      };


      const newLesson = transactionalEntityManager.create(Lesson, newLessonData);
      const savedLesson = await transactionalEntityManager.save(Lesson, newLesson);

      if (!savedLesson) {
        throw new Error(`${RESPONSE_MESSAGES.ERROR.LESSON_SAVE_FAILED}: ${originalLesson.title}`);
      }


      // Clone associated files if lesson has them
      if (originalLesson.associatedFiles && originalLesson.associatedFiles.length > 0) {
        try {
          await this.cloneAssociatedFilesWithTransaction(originalLesson.lessonId, savedLesson.lessonId, userId, tenantId, organisationId, transactionalEntityManager);
        } catch (error) {
          this.logger.error(`Error cloning associated files for lesson ${originalLesson.lessonId}: ${error.message}`);
          // Don't throw here as the lesson was already saved
        }
      }

      return savedLesson;
    } catch (error) {
      this.logger.error(`Error in cloneLessonWithTransaction for lesson ${originalLesson.lessonId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clone associated files for a lesson using transaction
   */
  private async cloneAssociatedFilesWithTransaction(
    originalLessonId: string,
    newLessonId: string,
    userId: string,
    tenantId: string,
    organisationId: string,
    transactionalEntityManager: any,
  ): Promise<void> {
    try {
      const associatedFiles = await transactionalEntityManager.find(AssociatedFile, {
        where: {
          lessonId: originalLessonId,
          tenantId,
          organisationId,
        },
        relations: ['media'],
      });

      if (!associatedFiles || associatedFiles.length === 0) {
        this.logger.warn(`No associated files found for lesson ${originalLessonId}`);
        return;
      }

      for (const associatedFile of associatedFiles) {
        try {
          let newMediaId: string | undefined;

          // Clone media if it exists
          if (associatedFile.media) {
            const originalMedia = associatedFile.media;
            const newMediaData = {
              ...originalMedia,
              createdBy: userId,
              updatedBy: userId,
              // Remove properties that should not be copied
              mediaId: undefined,
            };

            const newMedia = transactionalEntityManager.create(Media, newMediaData);
            const savedMedia = await transactionalEntityManager.save(Media, newMedia);
            
            if (!savedMedia) {
              throw new Error(RESPONSE_MESSAGES.ERROR.MEDIA_SAVE_FAILED);
            }
            
            newMediaId = savedMedia.mediaId;
            this.logger.log(`Cloned associated file media from ${originalMedia.mediaId} to ${newMediaId}`);

            // Create new associated file record
            const newAssociatedFileData = {
              lessonId: newLessonId,
              mediaId: newMediaId,
              tenantId,
              organisationId,
              createdBy: userId,
              updatedBy: userId,
            };

            const newAssociatedFile = transactionalEntityManager.create(AssociatedFile, newAssociatedFileData);
            const savedAssociatedFile = await transactionalEntityManager.save(AssociatedFile, newAssociatedFile);
            
            if (!savedAssociatedFile) {
              throw new Error(RESPONSE_MESSAGES.ERROR.ASSOCIATED_FILE_SAVE_FAILED);
            }
          }
        } catch (error) {
          this.logger.error(`Error cloning associated file ${associatedFile.associatedFileId}: ${error.message}`);
          // Continue with other files even if one fails
        }
      }
    } catch (error) {
      this.logger.error(`Error in cloneAssociatedFilesWithTransaction for lesson ${originalLessonId}: ${error.message}`);
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
}