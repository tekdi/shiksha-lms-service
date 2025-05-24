import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, FindOneOptions } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Lesson } from './entities/lesson.entity';
import { LessonStatus } from './entities/lesson.entity';
import { CourseLesson } from './entities/course-lesson.entity';
import { CourseLessonStatus } from './entities/course-lesson.status';
import { Course, CourseStatus } from '../courses/entities/course.entity';
import { Module, ModuleStatus } from '../modules/entities/module.entity';
import { Media } from '../media/entities/media.entity';
import { LessonTrack } from '../tracking/entities/lesson-track.entity';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { AddLessonToCourseDto } from './dto/add-lesson-to-course.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { HelperUtil } from '../common/utils/helper.util';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { MediaContentDto, MediaFormat, MediaSubFormat } from './dto/media-content.dto';
import { AttemptsGradeMethod } from './entities/lesson.entity';

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);

  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(CourseLesson)
    private readonly courseLessonRepository: Repository<CourseLesson>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Module)
    private readonly moduleRepository: Repository<Module>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(LessonTrack)
    private readonly lessonTrackRepository: Repository<LessonTrack>
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
    organisationId: string,
  ): Promise<Lesson | CourseLesson> {
    try {
      // Create media first based on the format
      let mediaId: string;
      
      if (createLessonDto.mediaContent.format === MediaFormat.DOCUMENT) {
        // For document format, use the provided mediaId
        if (!createLessonDto.mediaContent.mediaId) {
          throw new BadRequestException('Media ID is required for document format');
        }
        mediaId = createLessonDto.mediaContent.mediaId;
      } else {
        // Create new media for other formats
        const mediaData: Partial<Media> = {
          format: createLessonDto.mediaContent.format as any, // Type assertion needed due to enum mismatch
          subFormat: createLessonDto.mediaContent.subFormat || this.getDefaultSubFormat(createLessonDto.mediaContent.format),
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
        noOfAttempts: createLessonDto.noOfAttempts || 1,
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
      };

      // Generate a unique UUID for the lesson
      const lessonId = uuidv4();

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
        const existingAliases = await this.lessonRepository.find({
          where: { 
            ...(tenantId && { tenantId }),
            ...(organisationId && { organisationId }),
            status: Not(LessonStatus.ARCHIVED),
          },
          select: ['alias'],
        }).then(lessons => lessons.map(lesson => lesson.alias).filter(Boolean));

        const originalAlias = createLessonDto.alias;
        createLessonDto.alias = HelperUtil.generateUniqueAlias(
          originalAlias || '',
          existingAliases
        );
        this.logger.log(`Alias '${originalAlias}' already exists. Generated new alias: ${createLessonDto.alias}`);
      }

      // Create a new lesson with lesson entity fields only
      const lesson = this.lessonRepository.create(lessonData);
      const savedLesson = await this.lessonRepository.save(lesson);
      
      // Check if courseId and moduleId are provided to create course association
      if (createLessonDto.courseId) {
        // Validate course exists
        const course = await this.courseRepository.findOne({
          where: { 
            courseId: createLessonDto.courseId,
            ...(tenantId && { tenantId }),
            ...(organisationId && { organisationId }),
            status: Not(CourseStatus.ARCHIVED as any),
          },
        });
        
        if (!course) {
          throw new NotFoundException('Course not found');
        }
        
        // If moduleId is provided, validate it exists and belongs to the course
        if (createLessonDto.moduleId) {
          const module = await this.moduleRepository.findOne({
            where: { 
              moduleId: createLessonDto.moduleId,
              courseId: createLessonDto.courseId,
              ...(tenantId && { tenantId }),
              ...(organisationId && { organisationId }),
              status: Not(ModuleStatus.ARCHIVED as any),
            },
          });
          
          if (!module) {
            throw new NotFoundException('Module not found or does not belong to the specified course');
          }
        }
        
        // Create course-lesson association
        const courseLessonId = uuidv4();
        const courseLessonData = {
          courseLessonId,
          lessonId: savedLesson.lessonId,
          courseId: createLessonDto.courseId,
          moduleId: createLessonDto.moduleId || undefined,
          tenantId,
          organisationId,
          freeLesson: createLessonDto.freeLesson || false,
          considerForPassing: createLessonDto.considerForPassing || true,
          status: CourseLessonStatus.PUBLISHED,
          startDatetime: createLessonDto.startDatetime ? new Date(createLessonDto.startDatetime) : undefined,
          endDatetime: createLessonDto.endDatetime ? new Date(createLessonDto.endDatetime) : undefined,
          noOfAttempts: createLessonDto.noOfAttempts,
          attemptsGrade: createLessonDto.attemptsGrade,
          eligibilityCriteria: createLessonDto.eligibilityCriteria,
          idealTime: createLessonDto.idealTime,
          resume: createLessonDto.resume,
          totalMarks: createLessonDto.totalMarks,
          passingMarks: createLessonDto.passingMarks,
          params: createLessonDto.params,
          createdBy: userId,
          updatedBy: userId,
        };
        
        // Create and save the course-lesson association
        const courseLesson = this.courseLessonRepository.create(courseLessonData);
        const savedCourseLesson = await this.courseLessonRepository.save(courseLesson);
        
        // Return the course lesson association which includes the lesson reference
        return Array.isArray(savedCourseLesson) ? savedCourseLesson[0] : savedCourseLesson;
      }
      
      // If no courseId provided, return just the lesson
      return Array.isArray(savedLesson) ? savedLesson[0] : savedLesson;
    } catch (error) {
      this.logger.error(`Error creating lesson: ${error.message}`);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Error creating lesson');
    }
  }

  private getDefaultSubFormat(format: MediaFormat): MediaSubFormat {
    switch (format) {
      case MediaFormat.VIDEO:
        return MediaSubFormat.VIDEO_YOUTUBE;
      case MediaFormat.EVENT:
        return MediaSubFormat.EVENT;
      case MediaFormat.TEST:
        return MediaSubFormat.TEST_QUIZ;
      default:
        throw new BadRequestException('Invalid media format');
    }
  }

  /**
   * Add a lesson to a course and/or module
   */
  async addToCourse(
    addLessonToCourseDto: AddLessonToCourseDto,
    courseId: string,
    moduleId: string,
    userId: string,
    tenantId?: string,
    organisationId?: string
  ): Promise<CourseLesson> {
    try {
      const { lessonId, ...restDto } = addLessonToCourseDto;

      // Build where clause with data isolation
      const lessonWhereClause: any = { 
        lessonId, 
        status: Not('archived') as any 
      };
      
      // Add tenant and org filters if provided
      if (tenantId) {
        lessonWhereClause.tenantId = tenantId;
      }
      
      if (organisationId) {
        lessonWhereClause.organisationId = organisationId;
      }

      // Validate lesson exists with data isolation
      const lesson = await this.lessonRepository.findOne({
        where: lessonWhereClause,
      });
      
      if (!lesson) {
        throw new NotFoundException('Lesson not found');
      }

      // Validate course exists with data isolation
      const courseWhereClause: any = { 
        courseId, 
        status: Not(CourseStatus.ARCHIVED as any) 
      };
      
      // Add tenant and org filters if provided
      if (tenantId) {
        courseWhereClause.tenantId = tenantId;
      }
      
      if (organisationId) {
        courseWhereClause.organisationId = organisationId;
      }
      
      const course = await this.courseRepository.findOne({
        where: courseWhereClause as any,
      });
      
      if (!course) {
        throw new NotFoundException('Course not found');
      }

      // Validate module exists if moduleId is provided with data isolation
      if (moduleId) {
        const moduleWhereClause: any = { 
          moduleId, 
          courseId,
          status: Not(ModuleStatus.ARCHIVED as any) 
        };
        
        // Add tenant and org filters if provided
        if (tenantId) {
          moduleWhereClause.tenantId = tenantId;
        }
        
        if (organisationId) {
          moduleWhereClause.organisationId = organisationId;
        }
        
        const module = await this.moduleRepository.findOne({
          where: moduleWhereClause as any,
        });
        
        if (!module) {
          throw new NotFoundException('Module not found or not associated with the course');
        }
      }

      // Check if the lesson is already associated with the course and module with data isolation
      const existingCourseLessonWhereClause: any = {
        lessonId,
        courseId,
        moduleId,
        status: Not(CourseLessonStatus.ARCHIVED as any),
      };
      
      // Add tenant and org filters if provided
      if (tenantId) {
        existingCourseLessonWhereClause.tenantId = tenantId;
      }
      
      if (organisationId) {
        existingCourseLessonWhereClause.organisationId = organisationId;
      }
      
      const existingCourseLesson = await this.courseLessonRepository.findOne({
        where: existingCourseLessonWhereClause,
      });
      
      if (existingCourseLesson) {
        throw new ConflictException(RESPONSE_MESSAGES.ERROR.LESSON_ALREADY_EXISTS);
      }

      // Generate a unique ID for the association
      const courseLessonId = uuidv4();

      // Create the course-lesson association - extract only the fields in the entity
      const courseLesson = this.courseLessonRepository.create({
        courseLessonId,
        lessonId,
        courseId,
        moduleId,
        tenantId,
        organisationId,
        freeLesson: restDto.freeLesson,
        considerForPassing: restDto.considerForPassing,
        status: restDto.status || CourseLessonStatus.PUBLISHED,
        startDatetime: restDto.startDatetime ? new Date(restDto.startDatetime) : undefined,
        endDatetime: restDto.endDatetime ? new Date(restDto.endDatetime) : undefined,
        noOfAttempts: restDto.noOfAttempts,
        attemptsGrade: restDto.attemptsGrade,
        eligibilityCriteria: restDto.eligibilityCriteria,
        idealTime: restDto.idealTime,
        resume: restDto.resume,
        totalMarks: restDto.totalMarks,
        passingMarks: restDto.passingMarks,
        params: restDto.params,
        createdBy: userId,
        updatedBy: userId,
      });

      // Save the association
      const savedCourseLesson = await this.courseLessonRepository.save(courseLesson);
      // TypeORM returns an array when saving an entity, but we need a single entity
      return Array.isArray(savedCourseLesson) ? savedCourseLesson[0] : savedCourseLesson;
    } catch (error) {
      this.logger.error(`Error adding lesson to course: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Error adding lesson to course');
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
      const skip = (page - 1) * limit;

      // Build query with filters
      const whereConditions: any = {
        status: Not('archived'), // Exclude archived lessons by default
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

      return { count, lessons };
    } catch (error) {
      this.logger.error(`Error finding lessons: ${error.message}`);
      throw new InternalServerErrorException('Error retrieving lessons');
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
    userId?: string,
    tenantId?: string,
    organisationId?: string    
  ): Promise<Lesson> {
    try {
      // Build where clause with required filters
      const whereClause: any = { 
        lessonId: lessonId, 
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
       
      });

      if (!lesson) {
        throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
      }

      return lesson;
    } catch (error) {
      this.logger.error(`Error finding lesson by ID: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error retrieving lesson');
    }
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
    try {
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

      // Build where clause for course lessons
      const courseLessonWhereClause: any = { 
        moduleId, 
        status: Not(CourseLessonStatus.ARCHIVED as any) 
      };
      
      // Add tenant and org filters to course lessons if provided
      if (tenantId) {
        courseLessonWhereClause.tenantId = tenantId;
      }
      
      if (organisationId) {
        courseLessonWhereClause.organisationId = organisationId;
      }
      
      // Get all course-lesson associations for this module with filtering
      const courseLessons = await this.courseLessonRepository.find({
        where: courseLessonWhereClause,
        relations: ['lesson', 'lesson.media'],
      });

      // Transform the data for the response
      const lessons = courseLessons.map(courseLesson => ({
        courseLessonId: courseLesson.courseLessonId,
        lessonId: courseLesson.lessonId,
        courseId: courseLesson.courseId,
        title: courseLesson.lesson.title,
        description: courseLesson.lesson.description,
        format: courseLesson.lesson.format,
        freeLesson: courseLesson.freeLesson,
        totalMarks: courseLesson.totalMarks,
        passingMarks: courseLesson.passingMarks,
        status: courseLesson.status,
        media: courseLesson.lesson.media,
      }));

      return lessons;
    } catch (error) {
      this.logger.error(`Error finding lessons by module ID: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error retrieving lessons for module');
    }
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
    userId?: string ,   
    tenantId?: string,
    organisationId?: string,
    image?: Express.Multer.File,
  ): Promise<Lesson> {
    try {
      // Find the lesson to update using tenant/org filtering
      const lesson = await this.findOne(lessonId, tenantId, organisationId);

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

      // If title is changed but no alias provided, generate one from the title
      if (updateLessonDto.title && updateLessonDto.title !== lesson.title && !updateLessonDto.alias) {
        updateLessonDto.alias = HelperUtil.generateUniqueAlias(
          updateLessonDto.title,
          [],
          0
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
          // Now we need to get all aliases to generate a unique one
          const existingAliases = await this.lessonRepository.find({
            where: { 
              ...(tenantId && { tenantId }),
              ...(organisationId && { organisationId }),
              lessonId: Not(lessonId),
              status: Not(LessonStatus.ARCHIVED),
            },
            select: ['alias'],
          }).then(lessons => lessons.map(lesson => lesson.alias).filter(Boolean));
          
          const originalAlias = updateLessonDto.alias;
          updateLessonDto.alias = HelperUtil.generateUniqueAlias(
            originalAlias,
            existingAliases
          );
          this.logger.log(`Alias '${originalAlias}' already exists. Generated new alias: ${updateLessonDto.alias}`);
        }
      }


      // Map DTO properties to entity properties that exist in the DTO
      const updateData: any = {
        updatedBy: updateLessonDto.updatedBy || 'system',
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
      
      // Update the lesson
      const updatedLesson = this.lessonRepository.merge(lesson, updateData);
      return this.lessonRepository.save(updatedLesson);
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
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async remove(
    lessonId: string,
    tenantId?: string,
    organisationId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Find the lesson to remove using tenant/org filtering
      const lesson = await this.findOne(lessonId, tenantId, organisationId);

      if (!lesson) {
        throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
      }

      // Archive the lesson by changing its status
      lesson.status = LessonStatus.ARCHIVED;
      lesson.updatedAt = new Date();

      // Save the updated lesson
      await this.lessonRepository.save(lesson);

      // Also archive all course-lesson associations with tenant/org filtering
      const courseLessonWhereClause: any = { 
        lessonId, 
        status: Not(CourseLessonStatus.ARCHIVED as any) 
      };
      
      // Add tenant and org filters if provided
      if (tenantId) {
        courseLessonWhereClause.tenantId = tenantId;
      }
      
      if (organisationId) {
        courseLessonWhereClause.organisationId = organisationId;
      }
      
      const courseLessons = await this.courseLessonRepository.find({
        where: courseLessonWhereClause,
      });

      for (const courseLesson of courseLessons) {
        courseLesson.status = CourseLessonStatus.ARCHIVED;
        courseLesson.updatedAt = new Date();
        await this.courseLessonRepository.save(courseLesson);
      }

      return { success: true, message: RESPONSE_MESSAGES.LESSON_DELETED };
    } catch (error) {
      this.logger.error(`Error removing lesson: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error removing lesson');
    }
  }

  /**
   * Remove a lesson from a course/module
   * @param courseLessonId The course-lesson ID to remove
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async removeFromCourse(
    courseLessonId: string,
    tenantId?: string,
    organisationId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Build where clause with required filters
      const courseLessonWhereClause: any = { 
        courseLessonId, 
        status: Not(CourseLessonStatus.ARCHIVED as any) 
      };
      
      // Add tenant and org filters if provided
      if (tenantId) {
        courseLessonWhereClause.tenantId = tenantId;
      }
      
      if (organisationId) {
        courseLessonWhereClause.organisationId = organisationId;
      }
      
      // Find the course-lesson association with proper filtering
      const courseLesson = await this.courseLessonRepository.findOne({
        where: courseLessonWhereClause,
      });

      if (!courseLesson) {
        throw new NotFoundException('Course-lesson association not found');
      }

      // Archive the association by changing its status
      courseLesson.status = CourseLessonStatus.ARCHIVED;
      courseLesson.updatedAt = new Date();

      // Save the updated association
      await this.courseLessonRepository.save(courseLesson);

      return { success: true, message: 'Lesson removed from course successfully' };
    } catch (error) {
      this.logger.error(`Error removing lesson from course: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error removing lesson from course');
    }
  }

  /**
   * Find lesson to display (with course-specific parameters if available)
   * @param lessonId The lesson ID to find
   * @param courseLessonId Optional course-lesson association ID
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async findToDisplay(
    lessonId: string, 
    courseLessonId?: string,
    tenantId?: string,
    organisationId?: string
  ): Promise<any> {
    try {
      // Build where clause for lesson with required filters
      const lessonWhereClause: any = { 
        lessonId, 
        status: Not(LessonStatus.ARCHIVED) 
      };
      
      // Add tenant and org filters if provided
      if (tenantId) {
        lessonWhereClause.tenantId = tenantId;
      }
      
      if (organisationId) {
        lessonWhereClause.organisationId = organisationId;
      }
      
      // Find the lesson with proper filtering
      const lesson = await this.lessonRepository.findOne({
        where: lessonWhereClause,
        relations: ['media'],
      });

      if (!lesson) {
        throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
      }

      let courseLesson: CourseLesson | null = null;
      if (courseLessonId) {
        // Build where clause for course-lesson with required filters
        const courseLessonWhereClause: any = { 
          courseLessonId, 
          status: Not(CourseLessonStatus.ARCHIVED as any) 
        };
        
        // Add tenant and org filters if provided
        if (tenantId) {
          courseLessonWhereClause.tenantId = tenantId;
        }
        
        if (organisationId) {
          courseLessonWhereClause.organisationId = organisationId;
        }
        
        courseLesson = await this.courseLessonRepository.findOne({
          where: courseLessonWhereClause,
        });
        
        if (!courseLesson) {
          throw new NotFoundException('Course-lesson association not found');
        }
      }

      // Combine lesson and course-specific parameters
      const result = {
        ...lesson,
        courseSpecific: courseLesson ? {
          courseLessonId: courseLesson.courseLessonId,
          courseId: courseLesson.courseId,
          moduleId: courseLesson.moduleId,
          freeLesson: courseLesson.freeLesson,
          considerForPassing: courseLesson.considerForPassing,
          startDatetime: courseLesson.startDatetime,
          endDatetime: courseLesson.endDatetime,
          noOfAttempts: courseLesson.noOfAttempts,
          attemptsGrade: courseLesson.attemptsGrade,
          eligibilityCriteria: courseLesson.eligibilityCriteria,
          idealTime: courseLesson.idealTime,
          resume: courseLesson.resume,
          totalMarks: courseLesson.totalMarks,
          passingMarks: courseLesson.passingMarks,
          params: courseLesson.params,
        } : null,
      };

      return result;
    } catch (error) {
      this.logger.error(`Error finding lesson to display: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error retrieving lesson to display');
    }
  }
}
