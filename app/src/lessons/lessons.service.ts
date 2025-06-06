import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, FindOneOptions } from 'typeorm';
import { Lesson, LessonStatus, AttemptsGradeMethod, LessonFormat } from './entities/lesson.entity';
import { Course } from '../courses/entities/course.entity';
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

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);
  private readonly cache_enabled: boolean;
  private readonly cache_ttl_default: number;
  private readonly cache_ttl_user: number;
  private readonly cache_prefix_lesson: string;
  private readonly cache_prefix_course: string;
  private readonly cache_prefix_media: string;
  private readonly cache_prefix_module: string;

  constructor(
    @InjectRepository(Lesson)
    private lessonRepository: Repository<Lesson>,
    @InjectRepository(Course)
    private courseRepository: Repository<Course>,
    @InjectRepository(Module)
    private moduleRepository: Repository<Module>,
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
    @InjectRepository(LessonTrack)
    private lessonTrackRepository: Repository<LessonTrack>,
    private cacheService: CacheService,
    private configService: ConfigService,
  ) {
    this.cache_enabled = this.configService.get('CACHE_ENABLED') === 'true';
    this.cache_ttl_default = parseInt(this.configService.get('CACHE_TTL_DEFAULT') || '3600', 10);
    this.cache_ttl_user = parseInt(this.configService.get('CACHE_TTL_USER') || '1800', 10);
    this.cache_prefix_lesson = this.configService.get('CACHE_LESSON_PREFIX') || 'lesson';
    this.cache_prefix_course = this.configService.get('CACHE_COURSE_PREFIX') || 'course';
    this.cache_prefix_media = this.configService.get('CACHE_MEDIA_PREFIX') || 'media';
    this.cache_prefix_module = this.configService.get('CACHE_MODULE_PREFIX') || 'module';
  }
  

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
    organisationId: string,
  ): Promise<Lesson> {
    try {

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

      // Create media first based on the format
      let mediaId: string;
      
      if (createLessonDto.format === LessonFormat.DOCUMENT) {
        // For document format, use the provided mediaId
        if (!createLessonDto.mediaContent.mediaId) {
          throw new BadRequestException('Media ID is required for document format');
        }
        mediaId = createLessonDto.mediaContent.mediaId;
      } else {
        // Create new media for other formats
        const mediaData: Partial<Media> = {
          tenantId: tenantId,
          organisationId: organisationId,
          format: createLessonDto.format,
          subFormat: createLessonDto.mediaContent.subFormat,
          source: createLessonDto.mediaContent.source,
          storage: createLessonDto.mediaContent.storage || 'local',
          createdBy: userId,
          updatedBy: userId,
        };

        const media = this.mediaRepository.create(mediaData);
        const savedMedia = await this.mediaRepository.save(media);
        mediaId = savedMedia.mediaId;
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
        storage: createLessonDto.storage || 'local',
        noOfAttempts: createLessonDto.noOfAttempts || 0,
        attemptsGrade: createLessonDto.attemptsGrade || AttemptsGradeMethod.HIGHEST,
        eligibilityCriteria: createLessonDto.eligibilityCriteria,
        idealTime: createLessonDto.idealTime,
        resume: createLessonDto.resume || false,
        totalMarks: createLessonDto.totalMarks,
        passingMarks: createLessonDto.passingMarks,
        params: createLessonDto.params || {},
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
      return Array.isArray(savedLesson) ? savedLesson[0] : savedLesson;
    } catch (error) {
      this.logger.error(`Error creating lesson: ${error.message}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Find all lessons with pagination and filters
   * @param paginationDto Pagination parameters
   * @param status Optional status filter
   * @param format Optional format filter
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async findAll(
    paginationDto: PaginationDto,
    status?: string,
    format?: string,
    tenantId?: string,
    organisationId?: string,
  ): Promise<{ count: number; lessons: Lesson[] }> {
    try {
      const { page = 1, limit = 10 } = paginationDto;
      const cacheKey = `${this.cache_prefix_lesson}:all:${tenantId}:${organisationId}:${page}:${limit}:${status || 'none'}:${format || 'none'}`;

      if (this.cache_enabled) {
        // Try to get from cache first
        const cachedResult = await this.cacheService.get<{ count: number; lessons: Lesson[] }>(cacheKey);
        if (cachedResult) {
          return cachedResult;
        }
      }

      const skip = (page - 1) * limit;

      // Build query with filters
      const whereConditions: any = {
        status: Not(LessonStatus.ARCHIVED), // Exclude archived lessons by default
      };

      // Add optional filters
      if (status) {
        whereConditions.status = status;
      }

      if (format) {
        whereConditions.format = format;
      }
      
      // Add tenant and org filters if provided for data isolation
      if (tenantId) {
        whereConditions.tenantId = tenantId;
      }
      
      if (organisationId) {
        whereConditions.organisationId = organisationId;
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

      // Cache the result if caching is enabled
      if (this.cache_enabled) {
        await this.cacheService.set(cacheKey, result, this.cache_ttl_default);
      }

      return result;
    } catch (error) {
      this.logger.error(`Error finding lessons: ${error.message}`);
      throw new InternalServerErrorException('Error retrieving lessons');
    }
  }

  /**
   * Find one lesson by ID
   * @param lessonId The lesson ID to find
   * @param userId The user ID for data isolation
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async findOne(
    lessonId: string,
    tenantId?: string,
    organisationId?: string    
  ): Promise<Lesson> {
    const cacheKey = `${this.cache_prefix_lesson}:${lessonId}:${tenantId}:${organisationId}`;
    
    if (this.cache_enabled) {
      const cachedLesson = await this.cacheService.get<Lesson>(cacheKey);
      if (cachedLesson) {
        return cachedLesson;
      }
    }

    // Build where clause with required filters
    const whereClause: any = { 
      lessonId, 
      status: Not(LessonStatus.ARCHIVED) 
    };
    
    // Add tenant and org filters if provided
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }
    
    if (organisationId) {
      whereClause.organisationId = organisationId;
    }
    
    const lesson = await this.lessonRepository.findOne({
      where: whereClause,
      relations: ['media', 'associatedFiles.media'],
    });

    if (!lesson) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
    }

    if (this.cache_enabled) {
      await this.cacheService.set(cacheKey, lesson, this.cache_ttl_default);
    }

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
    tenantId?: string,
    organisationId?: string
  ): Promise<any[]> {
    const cacheKey = `${this.cache_prefix_lesson}:module:${moduleId}:${tenantId}:${organisationId}`;
    
    if (this.cache_enabled) {
      const cachedLessons = await this.cacheService.get<any[]>(cacheKey);
      if (cachedLessons) {
        return cachedLessons;
      }
    }

    // Build where clause for module validation
    const moduleWhereClause: any = { 
      moduleId, 
      status: Not(ModuleStatus.ARCHIVED as any) 
    };
    
    // Add tenant and org filters if provided
    if (tenantId) {
      moduleWhereClause.tenantId = tenantId;
    }
    
    if (organisationId) {
      moduleWhereClause.organisationId = organisationId;
    }
    
    // Validate module exists with tenant/org filtering
    const module = await this.moduleRepository.findOne({
      where: moduleWhereClause,
    });
    
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    // Get all lessons for this module with filtering
    const lessons = await this.lessonRepository.find({
      where: { 
        moduleId, 
        status: Not(LessonStatus.ARCHIVED),
        ...(tenantId && { tenantId }),
        ...(organisationId && { organisationId }),
      },
      relations: ['media','associatedFiles.media'],
    });

    if (this.cache_enabled) {
      await this.cacheService.set(cacheKey, lessons, this.cache_ttl_default);
    }

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
    organisationId?: string,
    image?: Express.Multer.File,
  ): Promise<Lesson> {
    try {
      const lesson = await this.lessonRepository.findOne({
        where: { lessonId, tenantId, organisationId }
      });

      if (!lesson) {
        throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
      }

      // Check if lesson has a checked out status (if that property exists)
      if (updateLessonDto.checkedOut !== undefined) {
        throw new BadRequestException('Lesson is checked out by another user');
      }

      // Parse JSON params if they are provided as a string
      if (updateLessonDto.params && typeof updateLessonDto.params === 'string') {
        try {
          updateLessonDto.params = JSON.parse(updateLessonDto.params);
        } catch (error) {
          this.logger.error(`Error parsing params JSON: ${error.message}`);
          throw new BadRequestException('Invalid params JSON format');
        }
      }

      // Handle media updates if mediaContent is provided
      if (updateLessonDto.mediaContent) {
        // Get the current media
        const currentMedia = lesson.mediaId ? await this.mediaRepository.findOne({
          where: { mediaId: lesson.mediaId }
        }) : null;
        
          // For other formats
          // Validate format matches lesson format
          if (lesson.format !== updateLessonDto.mediaContent.format as LessonFormat) {
            throw new BadRequestException('Cannot change lesson format during update');
          }

          // Validate mediaId is provided
          if (!updateLessonDto.mediaContent.mediaId) {
            throw new BadRequestException('Media ID is required in mediaContent for non-document formats');
          }

          if (!currentMedia) {
            throw new NotFoundException(RESPONSE_MESSAGES.ERROR.MEDIA_NOT_FOUND);
          }

          // Update the media content
          await this.mediaRepository.update(currentMedia.mediaId, {
            tenantId: tenantId,
            organisationId: organisationId,
            format: updateLessonDto.mediaContent.format as LessonFormat,
            subFormat: updateLessonDto.mediaContent.subFormat,
            source: updateLessonDto.mediaContent.source,
            storage: updateLessonDto.mediaContent.storage || 'local',
            updatedBy: userId,
            updatedAt: new Date()
          });
      } else if (updateLessonDto.mediaId) {
        // Handle direct mediaId update
        const newMedia = await this.mediaRepository.findOne({
          where: { mediaId: updateLessonDto.mediaId }
        });

        if (!newMedia) {
          throw new NotFoundException(RESPONSE_MESSAGES.ERROR.MEDIA_NOT_FOUND);
        }

        // Get the current media
        const currentMedia = lesson.mediaId ? await this.mediaRepository.findOne({
          where: { mediaId: lesson.mediaId }
        }) : null;

        // If the media is the same, do nothing
        if (currentMedia && currentMedia.mediaId === newMedia.mediaId) {
          // Remove mediaId from update data since it's the same
          updateLessonDto.mediaId = undefined;
        } else {
          // If different media, archive old and use new
          if (currentMedia) {
            await this.mediaRepository.update(currentMedia.mediaId, {
              status: MediaStatus.ARCHIVED,
              updatedBy: userId,
              updatedAt: new Date()
            });
          }
          // Set the new mediaId in the lesson entity
          lesson.mediaId = newMedia.mediaId;
        }
      }

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
        };
        
        if (tenantId) {
          whereClause.tenantId = tenantId;
        }
        
        if (organisationId) {
          whereClause.organisationId = organisationId;
        }
        
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
      
      if (updateLessonDto.eligibilityCriteria !== undefined) {
        updateData.eligibilityCriteria = updateLessonDto.eligibilityCriteria;
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

      if (updateLessonDto.mediaId !== undefined) {
        updateData.mediaId = updateLessonDto.mediaId;
      }
      
      // Update the lesson
      const updatedLesson = this.lessonRepository.merge(lesson, updateData);
      const savedLesson = await this.lessonRepository.save(updatedLesson);

      if (this.cache_enabled) {
        const entityCacheKey = `${this.cache_prefix_lesson}:${lessonId}:${tenantId}:${organisationId}`;
        const displayCacheKey = `${this.cache_prefix_lesson}:display:${lessonId}:${tenantId}:${organisationId}`;
        const moduleCacheKey = `${this.cache_prefix_module}:lesson:${lessonId}:${tenantId}:${organisationId}`;
        const courseCacheKey = `${this.cache_prefix_course}:lesson:${lessonId}:${tenantId}:${organisationId}`;
        const mediaCacheKey = `${this.cache_prefix_media}:lesson:${lessonId}:${tenantId}:${organisationId}`;

        // Invalidate existing caches
        await Promise.all([
          this.cacheService.del(entityCacheKey),
          this.cacheService.del(displayCacheKey),
          this.cacheService.del(moduleCacheKey),
          this.cacheService.del(courseCacheKey),
          this.cacheService.del(mediaCacheKey)
        ]);

        // Set new cache values
        await Promise.all([
          this.cacheService.set(entityCacheKey, savedLesson, this.cache_ttl_default)
        ]);
      }

      return savedLesson;
    } catch (error) {
      this.logger.error(`Error updating lesson: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Error updating lesson');
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
    organisationId?: string,
  ): Promise<Lesson> {
    try {
      const lesson = await this.lessonRepository.findOne({
        where: { lessonId, tenantId, organisationId }
      });

      if (!lesson) {
        throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
      }

      // Archive the lesson
      lesson.status = LessonStatus.ARCHIVED;
      const savedLesson = await this.lessonRepository.save(lesson);

      if (this.cache_enabled) {
        const entityCacheKey = `${this.cache_prefix_lesson}:${lessonId}:${tenantId}:${organisationId}`;
        const displayCacheKey = `${this.cache_prefix_lesson}:display:${lessonId}:${tenantId}:${organisationId}`;
        const moduleCacheKey = `${this.cache_prefix_module}:lesson:${lessonId}:${tenantId}:${organisationId}`;
        const courseCacheKey = `${this.cache_prefix_course}:lesson:${lessonId}:${tenantId}:${organisationId}`;
        const mediaCacheKey = `${this.cache_prefix_media}:lesson:${lessonId}:${tenantId}:${organisationId}`;

        // Invalidate existing caches
        await Promise.all([
          this.cacheService.del(entityCacheKey),
          this.cacheService.del(displayCacheKey),
          this.cacheService.del(moduleCacheKey),
          this.cacheService.del(courseCacheKey),
          this.cacheService.del(mediaCacheKey)
        ]);

      }

      return savedLesson;
    } catch (error) {
      this.logger.error(`Error removing lesson: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Error removing lesson');
    }
  }

}
