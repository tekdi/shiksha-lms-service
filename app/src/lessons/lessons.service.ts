import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, FindOneOptions, FindOptionsWhere } from 'typeorm';
import { Lesson, LessonStatus, AttemptsGradeMethod, LessonFormat } from './entities/lesson.entity';
import { Course, CourseStatus } from '../courses/entities/course.entity';
import { Module, ModuleStatus } from '../modules/entities/module.entity';
import { Media, MediaStatus } from '../media/entities/media.entity';
import { LessonTrack } from '../tracking/entities/lesson-track.entity';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { HelperUtil } from '../common/utils/helper.util';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { CacheConfigService } from '../cache/cache-config.service';
import { OrderingService } from '../common/services/ordering.service';

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Module)
    private readonly moduleRepository: Repository<Module>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(LessonTrack)
    private readonly lessonTrackRepository: Repository<LessonTrack>,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    private readonly cacheConfig: CacheConfigService,
    private readonly orderingService: OrderingService
  ) {}
  

  /**
   * Create a new lesson with optional course association
   * @param createLessonDto The lesson data to create
   * @param userId The user ID for data isolation
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   * @param image Optional image file for the lesson
   * @returns The created lesson or course lesson association
   */
  async create(
    createLessonDto: CreateLessonDto,
    userId: string,
    tenantId: string,
    organisationId: string
  ): Promise<Lesson> {
    try {
      // Validate course and module existence if provided
      if (createLessonDto.courseId) {
        // Check if course exists
        const course = await this.courseRepository.findOne({
          where: { 
            courseId: createLessonDto.courseId,
            status: Not(CourseStatus.ARCHIVED),
            tenantId,
            organisationId,
          },
        });

        if (!course) {
          throw new NotFoundException(RESPONSE_MESSAGES.ERROR.COURSE_NOT_FOUND);
        }

        // If moduleId is provided, validate it belongs to the course
        if (createLessonDto.moduleId) {
          const module = await this.moduleRepository.findOne({
            where: { 
              moduleId: createLessonDto.moduleId,
              courseId: createLessonDto.courseId,
              status: Not(ModuleStatus.ARCHIVED),
              tenantId,
              organisationId,
            },
          });

          if (!module) {
            throw new NotFoundException(RESPONSE_MESSAGES.ERROR.MODULE_NOT_FOUND_IN_COURSE(createLessonDto.moduleId));
          }
        }
      }

      if (!createLessonDto.alias) {
        createLessonDto.alias = await HelperUtil.generateUniqueAliasWithRepo(
          createLessonDto.title,
          this.lessonRepository,
          tenantId,
          organisationId
        );
      }else{
        // Check if the alias already exists
        const whereClause: any = { 
          alias: createLessonDto.alias,
          status: Not(LessonStatus.ARCHIVED),
        };
      
      // Add tenant and org filters if they exist
      if (tenantId) {
        whereClause.tenantId = tenantId;
      }
      
      if (organisationId) {
        whereClause.organisationId = organisationId;
      }
      
      const existingLesson = await this.lessonRepository.findOne({
        where: whereClause,
      });
      

      if (existingLesson) {
        // Generate a unique alias since it already exists
        const originalAlias = createLessonDto.alias || createLessonDto.title || 'untitled-lesson';
        createLessonDto.alias = await HelperUtil.generateUniqueAliasWithRepo(
          originalAlias,
          this.lessonRepository,
          tenantId,
          organisationId
        );
          this.logger.log(`Alias '${originalAlias}' already exists. Generated new alias: ${createLessonDto.alias}`);
        }
      }

     
      let mediaId: string;
      let storage: string = 'local';
      if(createLessonDto.format === LessonFormat.DOCUMENT){
        storage = this.configService.get('cloud_storage_provider') || 'local';
      }
      
      // Create new media for all formats
      const mediaData: Partial<Media> = {
        tenantId: tenantId,
        organisationId: organisationId,
        format: createLessonDto.format,
        subFormat: createLessonDto.mediaContentSubFormat, 
        source: createLessonDto.mediaContentSource || undefined,
        path: createLessonDto.mediaContentPath || undefined,
        storage: storage,
        createdBy: userId,
        updatedBy: userId,
      };

      const media = this.mediaRepository.create(mediaData);
      const savedMedia = await this.mediaRepository.save(media);
      mediaId = savedMedia.mediaId;
      // Get next ordering if not provided
      let ordering = createLessonDto.ordering;
      if ((ordering === undefined || ordering === null) && createLessonDto.moduleId && createLessonDto.courseId) {
        ordering = await this.orderingService.getNextLessonOrder(
          createLessonDto.moduleId,
          createLessonDto.courseId,
          tenantId,
          organisationId
        );
      } else if (ordering === undefined || ordering === null) {
        ordering = 0; // Default ordering if no moduleId
      }

      // Create lesson data
      const lessonData = {
        title: createLessonDto.title,
        alias: createLessonDto.alias,
        format: createLessonDto.format,
        mediaId,
        image: createLessonDto.image,
        description: createLessonDto.description,
        status: createLessonDto.status || LessonStatus.PUBLISHED,
        startDatetime: createLessonDto.startDatetime ? new Date(createLessonDto.startDatetime) : undefined,
        endDatetime: createLessonDto.endDatetime ? new Date(createLessonDto.endDatetime) : undefined,
        storage: storage,
        noOfAttempts: createLessonDto.noOfAttempts || 0,
        attemptsGrade: createLessonDto.attemptsGrade || AttemptsGradeMethod.HIGHEST,
        prerequisites: createLessonDto.prerequisites,
        idealTime: createLessonDto.idealTime,
        resume: createLessonDto.resume || false,
        totalMarks: createLessonDto.totalMarks,
        passingMarks: createLessonDto.passingMarks,
        params: createLessonDto.params || {},
        ordering,
        createdBy: userId,
        updatedBy: userId,
        tenantId: tenantId,
        organisationId: organisationId,
        // Course-specific fields
        courseId: createLessonDto.courseId,
        moduleId: createLessonDto.moduleId,
        sampleLesson: createLessonDto.sampleLesson || false,
        considerForPassing: createLessonDto.considerForPassing || true,
      };

      // Create and save the lesson
      const lesson = this.lessonRepository.create(lessonData);
      const savedLesson = await this.lessonRepository.save(lesson);

      // Cache the new lesson with proper key and TTL
      const lessonKey = this.cacheConfig.getLessonKey(savedLesson.lessonId, tenantId, organisationId);
      await Promise.all([
        this.cacheService.set(lessonKey, savedLesson, this.cacheConfig.LESSON_TTL),
        this.cacheService.invalidateLesson(savedLesson.lessonId, savedLesson.moduleId, savedLesson.courseId, tenantId, organisationId),
      ]);
      return savedLesson;
    } catch (error) {
      this.logger.error(`Error creating lesson: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find all lessons with pagination and filters
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   * @param paginationDto Pagination parameters
   * @param status Optional status filter
   * @param format Optional format filter
   */
  async findAll(
    tenantId: string,
    organisationId: string,
    paginationDto: PaginationDto,
    status?: LessonStatus,
    format?: LessonFormat,
  ): Promise<{ count: number; lessons: Lesson[] }> {
    try {
      const { page = 1, limit = 10 } = paginationDto;
      // Generate cache key using standardized pattern
      const cacheKey = this.cacheConfig.getLessonPattern(tenantId, organisationId);

      // Try to get from cache first
      const cachedResult = await this.cacheService.get<{ count: number; lessons: Lesson[] }>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const skip = (page - 1) * limit;

      // Build query with filters
      const whereConditions: any = {
        status: Not(LessonStatus.ARCHIVED), // Exclude archived lessons by default
        tenantId: tenantId,
        organisationId: organisationId
      };

      // Add optional filters
      if (status) {
        whereConditions.status = status;
      }

      if (format) {
        whereConditions.format = format;
      }

      // Execute query with pagination
      const [lessons, count] = await this.lessonRepository.findAndCount({
        where: whereConditions,
        skip,
        take: limit,
        order: {
          createdAt: 'DESC',
        },
        relations: ['media'],
      });

      const result = { count, lessons };

      // Cache the result
      await this.cacheService.set(cacheKey, result, this.cacheConfig.LESSON_TTL);

      return result;
    } catch (error) {
      this.logger.error(`Error finding lessons: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find one lesson by ID
   * @param lessonId The lesson ID to find
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async findOne(
    lessonId: string,
    tenantId: string,
    organisationId: string
  ): Promise<Lesson> {
    // Check cache first
    const cacheKey = this.cacheConfig.getLessonKey(lessonId, tenantId, organisationId);
    const cachedLesson = await this.cacheService.get<Lesson>(cacheKey);
    if (cachedLesson) {
      return cachedLesson;
    }

    // Build where clause with required filters
    const whereClause: any = { 
      lessonId, 
      tenantId: tenantId,
      organisationId: organisationId,
      status: Not(LessonStatus.ARCHIVED) 
    };
        
    const lesson = await this.lessonRepository.findOne({
      where: whereClause,
      relations: ['media', 'associatedFiles.media'],
    });

    if (!lesson) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
    }

    // Cache the lesson
    await this.cacheService.set(cacheKey, lesson, this.cacheConfig.LESSON_TTL);

    return lesson;
  }

  /**
   * Find lessons by module ID
   * @param moduleId The module ID to filter by
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async findByModule(
    moduleId: string,
    tenantId: string,
    organisationId: string
  ): Promise<Lesson[]> {
    // Check cache first
    const cacheKey = this.cacheConfig.getModuleLessonsPattern(moduleId, tenantId, organisationId);
    const cachedLessons = await this.cacheService.get<Lesson[]>(cacheKey);
    if (cachedLessons) {
      return cachedLessons;
    }

    // Build where clause for module validation
    const moduleWhereClause: any = { 
      moduleId, 
      status: Not(ModuleStatus.ARCHIVED as any),
      tenantId: tenantId,
      organisationId: organisationId
    };
    
    // Validate module exists with tenant/org filtering
    const module = await this.moduleRepository.findOne({
      where: moduleWhereClause,
    });
    
    if (!module) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.MODULE_NOT_FOUND);
    }

    // Get all lessons for this module with filtering
    const lessons = await this.lessonRepository.find({
      where: { 
        moduleId, 
        status: Not(LessonStatus.ARCHIVED),
        tenantId: tenantId,
        organisationId: organisationId
      },
      order: { ordering: 'ASC' },
      relations: ['media','associatedFiles.media'],
    });

    // Cache the lessons
    await this.cacheService.set(cacheKey, lessons, this.cacheConfig.LESSON_TTL);

    return lessons;
  }

  /**
   * Update a lesson
   * @param lessonId The lesson ID to update
   * @param updateLessonDto The lesson data to update
   * @param image Optional image file for the lesson
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async update(
    lessonId: string,
    updateLessonDto: UpdateLessonDto,
    userId: string,
    tenantId: string,
    organisationId: string
  ): Promise<Lesson> {
    try {
      const lesson = await this.findOne(lessonId, tenantId, organisationId);

      if (!lesson) {
        throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
      }

      // Validate course and module existence if provided in update
      if (updateLessonDto.courseId) {
        // Check if course exists
        const course = await this.courseRepository.findOne({
          where: { 
            courseId: updateLessonDto.courseId,
            status: Not(CourseStatus.ARCHIVED),
            tenantId,
            organisationId,
          },
        });

        if (!course) {
          throw new NotFoundException(RESPONSE_MESSAGES.ERROR.COURSE_NOT_FOUND);
        }

        // If moduleId is provided, validate it belongs to the course
        if (updateLessonDto.moduleId) {
          const module = await this.moduleRepository.findOne({
            where: { 
              moduleId: updateLessonDto.moduleId,
              courseId: updateLessonDto.courseId,
              status: Not(ModuleStatus.ARCHIVED),
              tenantId,
              organisationId,
            },
          });

          if (!module) {
            throw new NotFoundException(RESPONSE_MESSAGES.ERROR.MODULE_NOT_FOUND_IN_COURSE(updateLessonDto.moduleId));
          }
        }
      }

      // Check if lesson has a checked out status (if that property exists)
      if (updateLessonDto.checkedOut !== undefined) {
        throw new BadRequestException(RESPONSE_MESSAGES.ERROR.LESSON_CHECKED_OUT);
      }

      // Parse JSON params if they are provided as a string
      if (updateLessonDto.params && typeof updateLessonDto.params === 'string') {
        try {
          updateLessonDto.params = JSON.parse(updateLessonDto.params);
        } catch (error) {
          this.logger.error(`Error parsing params JSON: ${error.message}`);
          throw new BadRequestException(RESPONSE_MESSAGES.ERROR.INVALID_PARAMS_FORMAT);
        }
      }

             // Get the current media
        const currentMedia = lesson.mediaId ? await this.mediaRepository.findOne({
          where: { mediaId: lesson.mediaId }
        }) : null;
        
          // For other formats
          // Validate format matches lesson format
          if (updateLessonDto.format && updateLessonDto.format !== lesson.format) {
            throw new BadRequestException(RESPONSE_MESSAGES.ERROR.CANNOT_CHANGE_FORMAT);
          }

          if (!currentMedia) {
            throw new NotFoundException(RESPONSE_MESSAGES.ERROR.MEDIA_NOT_FOUND);
          }

          let storage: string = 'local';
          if(updateLessonDto.format === LessonFormat.DOCUMENT){
            storage = this.configService.get('cloud_storage_provider') || 'local';
          }

          // Update the media content
          await this.mediaRepository.update(currentMedia.mediaId, {
            tenantId: tenantId,
            organisationId: organisationId,
            format: lesson.format as LessonFormat,
            subFormat: updateLessonDto.mediaContentSubFormat,
            source: updateLessonDto.mediaContentSource,
            path: updateLessonDto.mediaContentPath,
            storage: storage,
            updatedBy: userId,
            updatedAt: new Date()
          });
     
      // If title is changed but no alias provided, generate one from the title
      if (updateLessonDto.title && updateLessonDto.title !== lesson.title && !updateLessonDto.alias) {
        updateLessonDto.alias = await HelperUtil.generateUniqueAliasWithRepo(
          updateLessonDto.title,
          this.lessonRepository,
          tenantId || '',
          organisationId
        );
      }
      
      // Check for alias uniqueness if alias is being updated
      if (updateLessonDto.alias && updateLessonDto.alias !== lesson.alias) {
        const whereClause: any = {
          alias: updateLessonDto.alias,
          lessonId: Not(lessonId),
          status: Not(LessonStatus.ARCHIVED),
          tenantId: tenantId,
          organisationId: organisationId
        };
        
        const existingLesson = await this.lessonRepository.findOne({
          where: whereClause,
        });
        
        // If the alias already exists, generate a new unique one
        if (existingLesson) {
          const originalAlias = updateLessonDto.alias || updateLessonDto.title || 'untitled-lesson';
          updateLessonDto.alias = await HelperUtil.generateUniqueAliasWithRepo(
            originalAlias,
            this.lessonRepository,
            tenantId || '',
            organisationId
          );
          this.logger.log(`Alias '${originalAlias}' already exists. Generated new alias: ${updateLessonDto.alias}`);
        }
      }

      // Map DTO properties to entity properties that exist in the DTO
      const updateData: any = {
        updatedBy: userId,
        updatedAt: new Date(),
      };
      
      // Map fields that exist in both DTO and entity
      if (updateLessonDto.title !== undefined) {
        updateData.title = updateLessonDto.title;
      }
      
      if (updateLessonDto.description !== undefined) {
        updateData.description = updateLessonDto.description;
      }
      
      if (updateLessonDto.status !== undefined) {
        updateData.status = updateLessonDto.status;
      }
          
      if (updateLessonDto.alias !== undefined) {
        updateData.alias = updateLessonDto.alias;
      }
      
      if (updateLessonDto.startDatetime !== undefined) {
        updateData.startDatetime = new Date(updateLessonDto.startDatetime);
      }
      
      if (updateLessonDto.endDatetime !== undefined) {
        updateData.endDatetime = new Date(updateLessonDto.endDatetime);
      }
      
      if (updateLessonDto.storage !== undefined) {
        updateData.storage = updateLessonDto.storage;
      }
      
      if (updateLessonDto.noOfAttempts !== undefined) {
        updateData.noOfAttempts = updateLessonDto.noOfAttempts;
      }
      
      if (updateLessonDto.attemptsGrade !== undefined) {
        updateData.attemptsGrade = updateLessonDto.attemptsGrade;
      }
      
      if (updateLessonDto.prerequisites !== undefined) {
        updateData.prerequisites = updateLessonDto.prerequisites;
      }
      
      if (updateLessonDto.idealTime !== undefined) {
        updateData.idealTime = updateLessonDto.idealTime;
      }
      
      if (updateLessonDto.resume !== undefined) {
        updateData.resume = updateLessonDto.resume;
      }
      
      if (updateLessonDto.totalMarks !== undefined) {
        updateData.totalMarks = updateLessonDto.totalMarks;
      }
      
      if (updateLessonDto.passingMarks !== undefined) {
        updateData.passingMarks = updateLessonDto.passingMarks;
      }
      
      // Handle image field mapping
      if (updateLessonDto.image) {
        updateData.image = updateLessonDto.image;
      }
      
      if (updateLessonDto.params !== undefined) {
        updateData.params = updateLessonDto.params;
      }
      
      // Handle course and module association fields
      if (updateLessonDto.courseId !== undefined) {
        updateData.courseId = updateLessonDto.courseId;
      }
      
      if (updateLessonDto.moduleId !== undefined) {
        updateData.moduleId = updateLessonDto.moduleId;
      }
            
      // Update the lesson
      const updatedLesson = this.lessonRepository.merge(lesson, updateData);
      const savedLesson = await this.lessonRepository.save(updatedLesson);

      // Update cache and invalidate related caches
      const lessonKey = this.cacheConfig.getLessonKey(savedLesson.lessonId, tenantId, organisationId);
      await Promise.all([
        this.cacheService.set(lessonKey, savedLesson, this.cacheConfig.LESSON_TTL),
        this.cacheService.invalidateLesson(lessonId, lesson.moduleId, lesson.courseId, tenantId, organisationId),
      ]);

      return savedLesson;
    } catch (error) {
      this.logger.error(`Error updating lesson: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(RESPONSE_MESSAGES.ERROR.ERROR_UPDATING_LESSON);
    }
  }

  /**
   * Remove a lesson (archive it)
   * @param lessonId The lesson ID to remove
   * @param userId The user ID for data isolation
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async remove(
    lessonId: string,
    userId: string,
    tenantId: string,
    organisationId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const lesson = await this.findOne(lessonId, tenantId, organisationId);
      
      if (!lesson) {
        throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
      }

      // Soft delete by updating status
      lesson.status = LessonStatus.ARCHIVED;
      lesson.updatedBy = userId;
      await this.lessonRepository.save(lesson);

      // Invalidate all related caches
      const lessonKey = this.cacheConfig.getLessonKey(lessonId, tenantId, organisationId);
      await Promise.all([
        this.cacheService.del(lessonKey),
        this.cacheService.invalidateLesson(lessonId, lesson.moduleId, lesson.courseId, tenantId, organisationId),
      ]);

      return {
        success: true,
        message: 'Lesson deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Error removing lesson: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(RESPONSE_MESSAGES.ERROR.ERROR_REMOVING_LESSON);
    }
  }

}
