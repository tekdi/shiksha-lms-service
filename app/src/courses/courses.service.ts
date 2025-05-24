import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Not, Equal, ILike, IsNull } from 'typeorm';
import { Course, CourseStatus } from './entities/course.entity';
import { Module, ModuleStatus } from '../modules/entities/module.entity';
import { CourseLesson } from '../lessons/entities/course-lesson.entity';
import { CourseLessonStatus } from '../lessons/entities/course-lesson.status';
import { CourseTrack, TrackingStatus } from '../tracking/entities/course-track.entity';
import { LessonTrack } from '../tracking/entities/lesson-track.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { HelperUtil } from '../common/utils/helper.util';
import { CreateCourseDto } from './dto/create-course.dto';
import { SearchCourseDto } from './dto/search-course.dto';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Module)
    private readonly moduleRepository: Repository<Module>,
    @InjectRepository(CourseLesson)
    private readonly courseLessonRepository: Repository<CourseLesson>,
    @InjectRepository(CourseTrack)
    private readonly courseTrackRepository: Repository<CourseTrack>,
    @InjectRepository(LessonTrack)
    private readonly lessonTrackRepository: Repository<LessonTrack>,
  ) {}

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
      createCourseDto.alias = HelperUtil.generateUniqueAlias(
        createCourseDto.title,
        [],
        0
      );
    }
    
    // Check if the alias already exists
    const existingCourse = await this.courseRepository.findOne({
      where: { 
        alias: createCourseDto.alias, 
        tenantId,
        status: Not(CourseStatus.ARCHIVED)
      } as FindOptionsWhere<Course>,
    });

    if (existingCourse) {
      // Now we need to get all aliases to generate a unique one
      const existingAliases = await this.courseRepository.find({
        where: { 
          tenantId,
          status: Not(CourseStatus.ARCHIVED)
        } as FindOptionsWhere<Course>,
        select: ['alias'],
      }).then(courses => courses.map(course => course.alias).filter(Boolean));

      const originalAlias = createCourseDto.alias;
      createCourseDto.alias = HelperUtil.generateUniqueAlias(
        originalAlias,
        existingAliases
      );
      this.logger.log(`Alias '${originalAlias}' already exists. Generated new alias: ${createCourseDto.alias}`);
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
    return Array.isArray(savedCourse) ? savedCourse[0] : savedCourse;
  }

  /**
   * Search courses with filters and keyword search
   */
  async search(
    filters: Omit<SearchCourseDto, keyof PaginationDto>,
    paginationDto: PaginationDto,
    userId: string,
    tenantId: string,
    organisationId?: string,
  ): Promise<{ items: Course[]; total: number }> {
    const { page = 1, limit = 10 } = paginationDto;
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
    return this.courseRepository.findAndCount({
      where: whereClause,
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    }).then(([items, total]) => ({ items, total }));
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
        // Fetch all submodules for this module
        const submodules = await this.moduleRepository.find({
          where: { 
            parentId: module.moduleId,
            status: Not(ModuleStatus.ARCHIVED as any),
          },
          order: { ordering: 'ASC' },
        });

        // Fetch all lessons for this module
        const courseLessons = await this.courseLessonRepository.find({
          where: { 
            moduleId: module.moduleId, 
            status: Not(CourseLessonStatus.ARCHIVED as any),
          },
          relations: ['lesson'],
          order: { idealTime: 'ASC' },
        });

        const lessons = courseLessons.map(cl => ({
          id: cl.courseLessonId,
          lessonId: cl.lessonId,
          title: cl.lesson.title,
          description: cl.lesson.description,
          format: cl.lesson.format,
          status: cl.status,
          idealTime: cl.idealTime,
          freeLesson: cl.freeLesson,
        }));

        const enrichedSubmodules = await Promise.all(
          submodules.map(async (submodule) => {
            // Fetch all lessons for this submodule
            const submoduleLessons = await this.courseLessonRepository.find({
              where: { 
                moduleId: submodule.moduleId, 
                status: Not(CourseLessonStatus.ARCHIVED as any),
              },
              relations: ['lesson'],
              order: { idealTime: 'ASC' },
            });

            const lessons = submoduleLessons.map(cl => ({
              id: cl.courseLessonId,
              lessonId: cl.lessonId,
              title: cl.lesson.title,
              description: cl.lesson.description,
              format: cl.lesson.format,
              status: cl.status,
              idealTime: cl.idealTime,
              freeLesson: cl.freeLesson,
            }));

            return {
              ...submodule,
              lessons,
            };
          })
        );

        return {
          ...module,
          submodules: enrichedSubmodules,
          lessons,
        };
      })
    );

    return {
      ...course,
      modules: enrichedModules,
    };
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
      where: trackingWhereClause,
      relations: ['lessonTracks'],
    });

    // If there's no course tracking yet, return with default "not started" status
    if (!courseTracking) {
      return {
        ...courseHierarchy,
        tracking: {
          status: 'NOT_STARTED',
          progress: 0,
          completedLessons: 0,
          totalLessons: this.countTotalLessons(courseHierarchy),
          lastAccessed: null,
          timeSpent: 0
        },
      };
    }

    // Get all lesson tracks for this user and course with tenant/org filtering
    const lessonTrackWhereClause: any = {
      userId,
      courseId,
    };
    
    // Apply tenant and organization filters if they exist
    if (tenantId) {
      lessonTrackWhereClause.tenantId = tenantId;
    }
    
    if (organisationId) {
      lessonTrackWhereClause.organisationId = organisationId;
    }
    
    const lessonTracks = await this.lessonTrackRepository.find({
      where: lessonTrackWhereClause,
    });

    // Create a map of lesson IDs to their tracking data for quick lookup
    const lessonTrackMap = new Map();
    lessonTracks.forEach(track => {
      lessonTrackMap.set(track.lessonId, track);
    });

    // Calculate total time spent across all lesson tracks
    const totalTimeSpent = lessonTracks.reduce((sum, track) => sum + (track.timeSpent || 0), 0);

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
            score: lessonTrack.score
          } : {
            status: 'NOT_STARTED',
            progress: 0,
            lastAccessed: null,
            timeSpent: 0,
            score: null
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
              score: lessonTrack.score
            } : {
              status: 'NOT_STARTED',
              progress: 0,
              lastAccessed: null,
              timeSpent: 0,
              score: null
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
    return {
      ...courseHierarchy,
      modules: modulesWithTracking,
      tracking: {
        status: courseTracking.status,
        // Calculate progress based on completed vs total lessons
        progress: courseTracking.completedLessons / (courseTracking.noOfLessons || 1) * 100,
        completedLessons: courseTracking.completedLessons,
        totalLessons: courseTracking.noOfLessons || this.countTotalLessons(courseHierarchy),
        lastAccessed: courseTracking.lastAccessedDate,
        timeSpent: totalTimeSpent
      },
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
      updateCourseDto.alias = HelperUtil.generateUniqueAlias(
        updateCourseDto.title,
        [],
        0
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
        // Now we need to get all aliases to generate a unique one
        const existingAliases = await this.courseRepository.find({
          where: { 
            tenantId,
            ...(organisationId && { organisationId }),
            courseId: Not(courseId),
            status: Not(CourseStatus.ARCHIVED),
          } as FindOptionsWhere<Course>,
          select: ['alias'],
        }).then(courses => courses.map(course => course.alias).filter(Boolean));
        
        const originalAlias = updateCourseDto.alias;
        updateCourseDto.alias = HelperUtil.generateUniqueAlias(
          originalAlias,
          existingAliases
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
    
    return this.courseRepository.save(updatedCourse);
  }

  /**
   * Remove a course (archive it)
   * @param courseId The course ID to remove
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async remove(
    courseId: string,
    tenantId?: string,
    organisationId?: string
  ): Promise<{ success: boolean; message: string }> {
    // Find the course with tenant/org filtering
    const course = await this.findOne(courseId, tenantId, organisationId);
    
    course.status = CourseStatus.ARCHIVED;
    
    await this.courseRepository.save(course);
    
    return { 
      success: true, 
      message: RESPONSE_MESSAGES.COURSE_DELETED,
    };
  }

  /**
   * Helper method to count total lessons in a course hierarchy
   */
  private countTotalLessons(courseHierarchy: any): number {
    if (!courseHierarchy || !courseHierarchy.modules) {
      return 0;
    }

    let totalCount = 0;

    // Count lessons in each module and its submodules
    for (const module of courseHierarchy.modules) {
      // Count lessons directly in the module
      if (module.lessons && Array.isArray(module.lessons)) {
        totalCount += module.lessons.length;
      }

      // Count lessons in submodules
      if (module.submodules && Array.isArray(module.submodules)) {
        for (const submodule of module.submodules) {
          if (submodule.lessons && Array.isArray(submodule.lessons)) {
            totalCount += submodule.lessons.length;
          }
        }
      }
    }

    return totalCount;
  }

  /**
   * Helper method to extract all module IDs from course hierarchy
   */
  private extractModuleIds(modules: any[]): string[] {
    if (!modules || !Array.isArray(modules)) {
      return [];
    }

    const moduleIds: string[] = [];

    // Extract module IDs and their submodule IDs
    for (const module of modules) {
      if (module.id) {
        moduleIds.push(module.id);
      }

      // Process submodules
      if (module.submodules && Array.isArray(module.submodules)) {
        for (const submodule of module.submodules) {
          if (submodule.id) {
            moduleIds.push(submodule.id);
          }
        }
      }
    }

    return moduleIds;
  }

  /**
   * Helper method to extract all lesson IDs from course hierarchy
   */
  private extractLessonIds(modules: any[]): string[] {
    if (!modules || !Array.isArray(modules)) {
      return [];
    }

    const lessonIds: string[] = [];

    // Extract lesson IDs from modules and their submodules
    for (const module of modules) {
      // Process lessons in module
      if (module.lessons && Array.isArray(module.lessons)) {
        for (const lesson of module.lessons) {
          if (lesson.lessonId) {
            lessonIds.push(lesson.lessonId);
          }
        }
      }

      // Process lessons in submodules
      if (module.submodules && Array.isArray(module.submodules)) {
        for (const submodule of module.submodules) {
          if (submodule.lessons && Array.isArray(submodule.lessons)) {
            for (const lesson of submodule.lessons) {
              if (lesson.lessonId) {
                lessonIds.push(lesson.lessonId);
              }
            }
          }
        }
      }
    }

    return lessonIds;
  }
}