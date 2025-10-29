import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Not, FindManyOptions, IsNull, In } from 'typeorm';
import { CourseTrack, TrackingStatus } from './entities/course-track.entity';
import { LessonTrack } from './entities/lesson-track.entity';
import { Course, CourseStatus } from '../courses/entities/course.entity';
import { Lesson, LessonStatus, AttemptsGradeMethod } from '../lessons/entities/lesson.entity';
import { Module, ModuleStatus } from '../modules/entities/module.entity';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { UpdateLessonTrackingDto } from './dto/update-lesson-tracking.dto';
import { UpdateCourseTrackingDto } from './dto/update-course-tracking.dto';
import { UpdateEventProgressDto } from './dto/update-event-progress.dto';
import { LessonStatusDto } from './dto/lesson-status.dto';
import { ConfigService } from '@nestjs/config';
import { ModuleTrack, ModuleTrackStatus } from './entities/module-track.entity';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    @InjectRepository(CourseTrack)
    private readonly courseTrackRepository: Repository<CourseTrack>,
    @InjectRepository(LessonTrack)
    private readonly lessonTrackRepository: Repository<LessonTrack>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(Module)
    private readonly moduleRepository: Repository<Module>,
    @InjectRepository(ModuleTrack)
    private readonly moduleTrackRepository: Repository<ModuleTrack>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get course tracking
   * @param courseId The course ID
   * @param userId The user ID
   * @param tenantId The tenant ID for data isolation
   * @param orgId The organization ID for data isolation
   */
  async getCourseTracking(
    courseId: string, 
    userId: string,
    tenantId?: string,
    organisationId?: string
  ): Promise<CourseTrack> {
    // Build where clause with required filters
    const whereClause: any = { 
      courseId, 
      userId,
      tenantId,
      organisationId
    };
          
    const courseTrack = await this.courseTrackRepository.findOne({
      where: whereClause,
    });

    if (!courseTrack) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.COURSE_TRACKING_NOT_FOUND);
    }

    return courseTrack;
  }

  /**
   * Update course tracking
   * @param courseId The course ID
   * @param userId The user ID
   * @param updateCourseTrackingDto The update data
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async updateCourseTracking(
    courseId: string, 
    userId: string,
    updateCourseTrackingDto: UpdateCourseTrackingDto,
    tenantId?: string,
    organisationId?: string
  ): Promise<CourseTrack> {
    // Build where clause with required filters
    const whereClause: any = { 
      courseId, 
      userId,
      tenantId,
      organisationId
    };
          
    const courseTrack = await this.courseTrackRepository.findOne({
      where: whereClause,
    });

    if (!courseTrack) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.COURSE_TRACKING_NOT_FOUND);
    }

    // Update fields if provided in the DTO
    if (updateCourseTrackingDto.status !== undefined) {
      courseTrack.status = updateCourseTrackingDto.status;
    }

    if (updateCourseTrackingDto.startDatetime !== undefined) {
      courseTrack.startDatetime = new Date(updateCourseTrackingDto.startDatetime);
    }

    if (updateCourseTrackingDto.endDatetime !== undefined) {
      courseTrack.endDatetime = new Date(updateCourseTrackingDto.endDatetime);
    }

    if (updateCourseTrackingDto.noOfLessons !== undefined) {
      courseTrack.noOfLessons = updateCourseTrackingDto.noOfLessons;
    }

    if (updateCourseTrackingDto.completedLessons !== undefined) {
      courseTrack.completedLessons = updateCourseTrackingDto.completedLessons;
    }

    if (updateCourseTrackingDto.lastAccessedDate !== undefined) {
      courseTrack.lastAccessedDate = new Date(updateCourseTrackingDto.lastAccessedDate);
    }

    if (updateCourseTrackingDto.certGenDate !== undefined) {
      courseTrack.certGenDate = new Date(updateCourseTrackingDto.certGenDate);
    }
    
    // Auto-update status based on completion
    if (courseTrack.completedLessons === courseTrack.noOfLessons && courseTrack.noOfLessons > 0) {
      courseTrack.status = TrackingStatus.COMPLETED;
      if (!courseTrack.endDatetime) {
        courseTrack.endDatetime = new Date();
      }
    }
    
    // Update last accessed date if not explicitly provided
    if (!updateCourseTrackingDto.lastAccessedDate) {
      courseTrack.lastAccessedDate = new Date();
    }

    if (updateCourseTrackingDto.certificateIssued !== undefined) {
      courseTrack.certificateIssued = updateCourseTrackingDto.certificateIssued;
    }

    // Save the updated course track
    const updatedCourseTrack = await this.courseTrackRepository.save(courseTrack);

    return updatedCourseTrack;
  }

  /**
   * Start a new lesson attempt or get existing incomplete attempt
   */
  async startLessonAttempt(
    lessonId: string,
    userId: string,
    tenantId: string,
    organisationId: string
  ): Promise<LessonTrack> {
    // Get lesson details first
    const lesson = await this.lessonRepository.findOne({
      where: { 
        lessonId,
        tenantId,
        organisationId
      } as FindOptionsWhere<Lesson>,
    });

    if (!lesson) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
    }

    const courseId = lesson.courseId;
    
    if (!courseId) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.COURSE_LESSON_NOT_FOUND);
    }

    // Check prerequisites if any exist
    const prerequisiteCheck = await this.checkLessonsPrerequisites(
      lesson,
      userId,
      courseId,
      tenantId,
      organisationId
    );

    if (!prerequisiteCheck.isEligible && prerequisiteCheck.requiredLessons) {
      // Get the titles of missing prerequisite lessons for better error message
      const missingPrerequisiteLessons = prerequisiteCheck.requiredLessons.filter(l => !l.completed);
      const missingLessonTitles = missingPrerequisiteLessons.map(l => l.title).join(', ');
      throw new BadRequestException(
        `Cannot start lesson. Prerequisites not completed: ${missingLessonTitles}. Please complete the required lessons first.`
      );
    }

    //check if course is completed ,then throw error
    const courseTrack = await this.courseTrackRepository.findOne({
      where: {
        courseId,
        userId,
        tenantId,
        organisationId
      } as FindOptionsWhere<CourseTrack>,
    }); 
    // if (courseTrack && courseTrack.status === TrackingStatus.COMPLETED) {
    //   throw new BadRequestException(RESPONSE_MESSAGES.ERROR.COURSE_COMPLETED);
    // }
    // Find existing tracks for course lesson
    const existingTracks = await this.lessonTrackRepository.find({
      where: { 
        lessonId, 
        userId,
        courseId,
        tenantId,
        organisationId,
      } as FindOptionsWhere<LessonTrack>,
      order: { attempt: 'DESC' },
    });

    // If there's an incomplete attempt, return it
    const incompleteAttempt = existingTracks.find(track => track.status !== TrackingStatus.COMPLETED);
    if (incompleteAttempt) {
      //check can resume
      const canResume = lesson.resume ?? true;
      if (canResume) {
        return incompleteAttempt;
      }      
    }
    if (lesson.allowResubmission && existingTracks.length > 0) {
      // If resubmission is allowed, always return the existing attempt
      return existingTracks[0];
    }

    // Check max attempts
    const maxAttempts = lesson.noOfAttempts ?? 1;
    if (maxAttempts > 0 && existingTracks.length > 0 && existingTracks[0].attempt >= maxAttempts) {
      throw new BadRequestException(RESPONSE_MESSAGES.ERROR.MAX_ATTEMPTS_REACHED);
    }

    // Create new attempt
    const lessonTrack = this.lessonTrackRepository.create({
      userId,
      lessonId,
      courseId,
      tenantId,
      organisationId,
      attempt: existingTracks.length > 0 ? existingTracks[0].attempt + 1 : 1,
      status: TrackingStatus.STARTED,
      startDatetime: new Date(),
      totalContent: 0,
      completionPercentage: 0,
      score: 0,
      currentPosition: 0,
      timeSpent: 0
    });
    //update course tracking and module tracking as here new attempt is started
    await this.updateCourseAndModuleTracking(lessonTrack, tenantId, organisationId);
    const savedLessonTrack = await this.lessonTrackRepository.save(lessonTrack);

    return savedLessonTrack;
  }


  /**
   * Check if all prerequisites for a lesson are completed
   * @param lesson The lesson to check prerequisites for
   * @param userId The user ID
   * @param courseId The course ID
   * @param tenantId The tenant ID
   * @param organisationId The organization ID
   * @returns Promise with prerequisite status information
   */
  private async checkLessonsPrerequisites(
    lesson: Lesson,
    userId: string,
    courseId: string,
    tenantId: string,
    organisationId: string
  ): Promise<{isEligible: boolean, requiredLessons: any[]}> {
    if (!lesson.prerequisites || lesson.prerequisites.length === 0) {
      return {
        isEligible: true,
        requiredLessons: []
      };
    }

    const requiredLessons: any[] = [];
    let allCompleted = true;

    // Check each required lesson ID from the array
    for (const requiredLessonId of lesson.prerequisites) {
      // Fetch the required lesson details
      const requiredLesson = await this.lessonRepository.findOne({
        where: {
          lessonId: requiredLessonId,
          tenantId,
          organisationId,
          status: LessonStatus.PUBLISHED
        },
        select: ['lessonId', 'title']
      });

      if (!requiredLesson) {
        // If required lesson doesn't exist, consider it as not completed
        requiredLessons.push({
          lessonId: requiredLessonId,
          title: 'Unknown Lesson',
          completed: false
        });
        allCompleted = false;
        continue;
      }

      // Check if the user has completed this lesson
      const completedTrack = await this.lessonTrackRepository.findOne({
        where: {
          lessonId: requiredLessonId,
          userId,
          courseId,
          tenantId,
          organisationId,
          status: TrackingStatus.COMPLETED
        } as FindOptionsWhere<LessonTrack>,
      });

      const isCompleted = !!completedTrack;

      requiredLessons.push({
        lessonId: requiredLessonId,
        title: requiredLesson.title,
        completed: isCompleted
      });

      if (!isCompleted) {
        allCompleted = false;
      }
    }

    return {
      isEligible: allCompleted,
      requiredLessons
    };
  }


  /**
   * Manage lesson attempt - start over or resume
   */
  async manageLessonAttempt(
    lessonId: string,
    action: 'start' | 'resume',
    userId: string,
    tenantId: string,
    organisationId: string
  ): Promise<LessonTrack> {
    // Get lesson details first
    const lesson = await this.lessonRepository.findOne({
      where: { 
        lessonId,
        tenantId,
        organisationId
      } as FindOptionsWhere<Lesson>,
    });

    if (!lesson) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
    }

    const courseId = lesson.courseId;
    
    if (!courseId) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.COURSE_LESSON_NOT_FOUND);
    }
    
    // Find existing tracks for course lesson
    const existingTracks = await this.lessonTrackRepository.find({
      where: { 
        lessonId, 
        userId,
        courseId,
        tenantId,
        organisationId
      } as FindOptionsWhere<LessonTrack>,
      order: { attempt: 'DESC' },
      take: 1,
    });

    if (existingTracks.length === 0) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.NO_EXISTING_ATTEMPT);
    }
    

    const latestTrack = existingTracks[0];
   
    if (action === 'resume') {
      // For resubmission mode, always allow resume regardless of lesson.resume setting
      if (lesson.allowResubmission) {
        return latestTrack;
      }
      
      // Check if lesson allows resume
      const canResume = lesson.resume ?? true;
      if (!canResume) {
        throw new BadRequestException(RESPONSE_MESSAGES.ERROR.RESUME_NOT_ALLOWED);
      }
      if (latestTrack.status === TrackingStatus.COMPLETED) {
        throw new BadRequestException(RESPONSE_MESSAGES.ERROR.CANNOT_RESUME_COMPLETED);
      }
      return latestTrack;
    } else { 
      // start over
      if (lesson.allowResubmission) {
        // For resubmission mode, reset the existing attempt instead of creating new one
        latestTrack.status = TrackingStatus.STARTED;
        latestTrack.startDatetime = new Date();
        latestTrack.completionPercentage = 0;
        latestTrack.score = 0;
        latestTrack.totalContent = 0;
        latestTrack.currentPosition = 0;
        latestTrack.timeSpent = 0;
        
        const savedTracking = await this.lessonTrackRepository.save(latestTrack);
        return savedTracking;
      }
      
      if (latestTrack.status === TrackingStatus.COMPLETED) {
        throw new BadRequestException(RESPONSE_MESSAGES.ERROR.CANNOT_START_COMPLETED);
      }
      
      // Check max attempts
      const maxAttempts = lesson.noOfAttempts || 1;
      if (maxAttempts > 0 && latestTrack.attempt >= maxAttempts) {
        throw new BadRequestException(RESPONSE_MESSAGES.ERROR.MAX_ATTEMPTS_REACHED);
      }

      // Create new attempt
      const lessonTrack = this.lessonTrackRepository.create({
        userId,
        lessonId,
        courseId,
        tenantId,
        organisationId,
        attempt: latestTrack.attempt,
        status: TrackingStatus.STARTED,
        startDatetime: new Date(),
        completionPercentage: 0,
        score: 0,
        totalContent: 0,
        currentPosition: 0,
        timeSpent: 0
      });
      
      const savedTracking = await this.lessonTrackRepository.save(lessonTrack);
      
      return savedTracking;
    }
  }

  /**
   * Get lesson status for a user
   */
  async getLessonStatus(
    lessonId: string,
    userId: string,
    tenantId: string,
    organisationId: string
  ): Promise<LessonStatusDto> {
    // Get lesson
    const lesson = await this.lessonRepository.findOne({
      where: { 
        lessonId,
        tenantId,
        organisationId,
        status: Not(LessonStatus.ARCHIVED)
      } as FindOptionsWhere<Lesson>,
    });

    if (!lesson) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
    }

    if (!lesson.courseId) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.COURSE_LESSON_NOT_FOUND);
    } 

    // Find latest attempt
    const latestTrack = await this.lessonTrackRepository.findOne({
      where: { 
        lessonId, 
        userId,
        courseId: lesson.courseId,
        tenantId,
        organisationId
      } as FindOptionsWhere<LessonTrack>,
      order: { attempt: 'DESC' },
    });

    //check lesson prerequisites
    const prerequisiteCheck = await this.checkLessonsPrerequisites(
      lesson,
      userId,
      lesson.courseId,
      tenantId,
      organisationId
    );

    const status: LessonStatusDto = {
      canResume: false,
      canReattempt: false,
      lastAttemptStatus: TrackingStatus.NOT_STARTED,
      lastAttemptId: null,
      isEligible: prerequisiteCheck.isEligible,
      requiredLessons: prerequisiteCheck.requiredLessons
    };

    if (!prerequisiteCheck.isEligible) {
      status.canResume = false;
      status.canReattempt = false;
      status.lastAttemptStatus = TrackingStatus.NOT_ELIGIBLE;
      status.lastAttemptId = null;
      status.isEligible = false;
      status.requiredLessons = prerequisiteCheck.requiredLessons;
      return status;
    }

    if (latestTrack) {
      status.lastAttemptId = latestTrack.lessonTrackId;
      status.lastAttemptStatus = latestTrack.status;

      if (lesson.allowResubmission) {
        // For resubmission mode, always allow resume and reattempt
        status.canResume = true;
        status.canReattempt = true;
      } else {
        // Original logic for non-resubmission mode
        const canResume = lesson.resume ?? true;
        if (canResume && (latestTrack.status === TrackingStatus.STARTED || latestTrack.status === TrackingStatus.INCOMPLETE)) {
          status.canResume = true;
        }

        const maxAttempts = lesson.noOfAttempts || 0;
        if ((maxAttempts === 0 || latestTrack.attempt < maxAttempts) && latestTrack.status === TrackingStatus.COMPLETED) {
          status.canReattempt = true;
        }
      }
    } else {
      // No attempts yet, can start first attempt
      status.canReattempt = true;
    }

    return status;
  }

  /**
   * Get an attempt
   */
  async getAttempt(
    attemptId: string,
    userId: string,
    tenantId: string,
    organisationId: string
  ): Promise<LessonTrack> {
    const attempt = await this.lessonTrackRepository.findOne({
      where: { 
        lessonTrackId: attemptId,
        userId,
        tenantId,
        organisationId
      } as FindOptionsWhere<LessonTrack>,
      relations: ['lesson', 'lesson.media'],
    });

    if (!attempt) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.ATTEMPT_NOT_FOUND);
    }

    return attempt;
  }

  /**
   * Update attempt progress
   */
  async updateProgress(
    attemptId: string,
    updateProgressDto: UpdateLessonTrackingDto,
    userId: string,
    tenantId: string,
    organisationId: string
  ): Promise<LessonTrack> {
    const attempt = await this.lessonTrackRepository.findOne({
      where: { 
        lessonTrackId: attemptId,
        userId,
        tenantId,
        organisationId
      } as FindOptionsWhere<LessonTrack>,
    });

    if (!attempt) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.ATTEMPT_NOT_FOUND);
    }

    // Update progress
    attempt.currentPosition = updateProgressDto.currentPosition || 0;
    attempt.score = updateProgressDto.score || 0;
    attempt.timeSpent = (attempt.timeSpent || 0) + (updateProgressDto.timeSpent || 0);
    attempt.totalContent = updateProgressDto.totalContent || 0;

    // Update completion percentage if provided
    if (updateProgressDto.completionPercentage !== undefined) {
      attempt.completionPercentage = updateProgressDto.completionPercentage;
    } else if (updateProgressDto.currentPosition && updateProgressDto.totalContent) {
      // Calculate completion percentage if not provided but position and total content are available
      attempt.completionPercentage = Math.round((updateProgressDto.currentPosition / updateProgressDto.totalContent) * 100);
    }

    // Update params if provided
    if (updateProgressDto.params) {
      attempt.params = updateProgressDto.params;
    }

    // Update status if completed
    if (updateProgressDto.currentPosition === updateProgressDto.totalContent || 
        (updateProgressDto.completionPercentage !== undefined && updateProgressDto.completionPercentage >= 100) ||
      (updateProgressDto.status === TrackingStatus.COMPLETED)) {
      attempt.status = TrackingStatus.COMPLETED;
      attempt.endDatetime = new Date();
      attempt.completionPercentage = 100; // Ensure completion percentage is 100 when completed
    } else if (attempt.status === TrackingStatus.STARTED) {
      attempt.status = TrackingStatus.INCOMPLETE;
    }

    if(updateProgressDto.status !== undefined) {
      attempt.status = updateProgressDto.status;
    }
    
    attempt.updatedAt = new Date();
    attempt.updatedBy = userId;

    const savedAttempt = await this.lessonTrackRepository.save(attempt);

    // Update course and module tracking if lesson is completed
    if (savedAttempt.courseId) {
      await this.updateCourseAndModuleTracking(savedAttempt, tenantId, organisationId);
    }

    return savedAttempt;
  }

  /**
   * Helper method to update course and module tracking
   */
  private async updateCourseAndModuleTracking(lessonTrack: LessonTrack, tenantId: string, organisationId: string): Promise<void> {
    if (!lessonTrack.courseId) {
      return;
    }

    // Get course track
    let courseTrack = await this.courseTrackRepository.findOne({
      where: { 
        courseId: lessonTrack.courseId, 
        userId: lessonTrack.userId,
        tenantId,
        organisationId
      } as FindOptionsWhere<CourseTrack>,
    });

    if (!courseTrack) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.COURSE_TRACKING_NOT_FOUND);   
    }

    // Update course track
    courseTrack.lastAccessedDate = new Date();

    // If the lesson is completed, update completed lessons count
    if (lessonTrack.status === TrackingStatus.COMPLETED || courseTrack.status === TrackingStatus.STARTED) {
      // Get all parent lessons for this course that have considerForPassing = true
      const courseLessons = await this.lessonRepository.find({
        where: { 
          courseId: lessonTrack.courseId,
          tenantId,
          organisationId,
          status: LessonStatus.PUBLISHED,
          considerForPassing: true,
          parentId: IsNull() // Only consider parent lessons for completion tracking
        } as FindOptionsWhere<Lesson>,
      });

      // Calculate completed lessons based on attemptsGrade
      const completedLessonsCount = await this.calculateCompletedLessonsBasedOnAttemptsGrade(
        courseLessons,
        lessonTrack.userId,
        lessonTrack.courseId,
        tenantId,
        organisationId
      );
      
      // Update course track
      courseTrack.completedLessons = completedLessonsCount;
      
      // Check if course is completed
      if (courseTrack.completedLessons >= courseTrack.noOfLessons && lessonTrack.status === TrackingStatus.COMPLETED) {
        courseTrack.status = TrackingStatus.COMPLETED;
        courseTrack.endDatetime = new Date();
        
      } else {
        courseTrack.status = TrackingStatus.INCOMPLETE;
      }
    }
    await this.courseTrackRepository.save(courseTrack);

    // Find and update module tracking if applicable
    const lesson = await this.lessonRepository.findOne({
      where: { 
        lessonId: lessonTrack.lessonId,
      } as FindOptionsWhere<Lesson>,
    });

    if (lesson && lesson.moduleId) {
      await this.updateModuleTracking(lesson.moduleId, lessonTrack.userId, lessonTrack.tenantId, lessonTrack.organisationId);
    }
  }

  /**
   * Calculate completed lessons based on attemptsGrade method
   */
  private async calculateCompletedLessonsBasedOnAttemptsGrade(
    lessons: Lesson[],
    userId: string,
    courseId: string | null,
    tenantId: string,
    organisationId: string
  ): Promise<number> {
    let completedLessonsCount = 0;

    for (const lesson of lessons) {
      // Get all attempts for this lesson
      const whereClause: any = { 
        lessonId: lesson.lessonId,
        userId,
        tenantId,
        organisationId,
        status: In([TrackingStatus.COMPLETED, TrackingStatus.SUBMITTED])
      };
      
      // Add courseId filter only if it's provided
      if (courseId) {
        whereClause.courseId = courseId;
      }

      const lessonAttempts = await this.lessonTrackRepository.find({
        where: whereClause as FindOptionsWhere<LessonTrack>,
        order: { attempt: 'ASC' }
      });

      if (lessonAttempts.length === 0) {
        continue; // No completed attempts
      }

      let isLessonCompleted = false;

      switch (lesson.attemptsGrade) {
        case AttemptsGradeMethod.FIRST_ATTEMPT:
          // Consider completed if first attempt is completed
          isLessonCompleted = lessonAttempts.some(attempt => attempt.attempt === 1);
          break;

        case AttemptsGradeMethod.LAST_ATTEMPT:
          // Consider completed if any attempt is completed (last attempt)
          isLessonCompleted = true;
          break;

        case AttemptsGradeMethod.AVERAGE:
          // Consider completed if average score meets passing criteria
          if (lesson.passingMarks && lesson.totalMarks) {
            const averageScore = lessonAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / lessonAttempts.length;
            const averagePercentage = (averageScore / lesson.totalMarks) * 100;
            isLessonCompleted = averagePercentage >= (lesson.passingMarks / lesson.totalMarks) * 100;
          } else {
            // If no passing criteria, consider completed if any attempt exists
            isLessonCompleted = true;
          }
          break;

        case AttemptsGradeMethod.HIGHEST:
          // Consider completed if highest score meets passing criteria
          if (lesson.passingMarks && lesson.totalMarks) {
            const highestScore = Math.max(...lessonAttempts.map(attempt => attempt.score || 0));
            const highestPercentage = (highestScore / lesson.totalMarks) * 100;
            isLessonCompleted = highestPercentage >= (lesson.passingMarks / lesson.totalMarks) * 100;
          } else {
            // If no passing criteria, consider completed if any attempt exists
            isLessonCompleted = true;
          }
          break;

        default:
          // Default behavior: consider completed if any attempt is completed
          isLessonCompleted = true;
          break;
      }

      if (isLessonCompleted) {
        completedLessonsCount++;
      }
    }

    return completedLessonsCount;
  }

  /**
   * Helper method to update module tracking
   */
  private async updateModuleTracking(moduleId: string, userId: string, tenantId: string, organisationId: string): Promise<void> {
    
    try {
    // Get module
    const module = await this.moduleRepository.findOne({
      where: { 
        moduleId,
        tenantId,
        organisationId,
        status: Not(ModuleStatus.ARCHIVED as any)
      } as FindOptionsWhere<Module>,
    });
    
    if (!module) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.MODULE_NOT_FOUND);
    }

    // Get or create module tracking
    let moduleTrack = await this.moduleTrackRepository.findOne({
      where: { 
        moduleId,
        userId,
        tenantId,
        organisationId
      } as FindOptionsWhere<ModuleTrack>,
    });

    if (!moduleTrack) {
      moduleTrack = this.moduleTrackRepository.create({
        moduleId,
        userId,
        tenantId,
        organisationId,
        status: ModuleTrackStatus.INCOMPLETE,
        completedLessons: 0,
        totalLessons: 0,
        progress: 0,
      });
    }

    // Get all parent lessons in this module with considerForPassing = true
    const moduleLessons = await this.lessonRepository.find({
      where: { 
        moduleId,
        tenantId,
        organisationId,
        status: LessonStatus.PUBLISHED,
        considerForPassing: true,
        parentId: IsNull() // Only consider parent lessons for completion tracking
      } as FindOptionsWhere<Lesson>,
    });

    // Calculate completed lessons based on attemptsGrade
    const completedLessonsCount = await this.calculateCompletedLessonsBasedOnAttemptsGrade(
      moduleLessons,
      userId,
      null, // No courseId for module tracking
      tenantId,
      organisationId
    );

    // Update module tracking data
    moduleTrack.completedLessons = completedLessonsCount;
    moduleTrack.totalLessons = moduleLessons.length;
    moduleTrack.progress = moduleLessons.length > 0 ? Math.round((completedLessonsCount / moduleLessons.length) * 100) : 0;

    // Update module status based on completion
    if (completedLessonsCount === moduleLessons.length && moduleLessons.length > 0) {
      moduleTrack.status = ModuleTrackStatus.COMPLETED;
    } else {
      moduleTrack.status = ModuleTrackStatus.INCOMPLETE;
    }

    await this.moduleTrackRepository.save(moduleTrack);

    } catch (error) {
      this.logger.error(`Error updating module tracking for moduleId: ${moduleId}, userId: ${userId}`, error);
      throw new BadRequestException(RESPONSE_MESSAGES.ERROR.MODULE_TRACKING_ERROR);
    }
  }

  /**
   * Update lesson completion by event ID
   * @param eventId The event ID that maps to lesson.media.source
   * @param updateEventProgressDto The update data containing userId, status, and timeSpent
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async updateEventProgress(
    eventId: string,
    updateEventProgressDto: UpdateEventProgressDto,
    tenantId: string,
    organisationId: string
  ): Promise<LessonTrack> {
    try {
      // Find lesson by media.source matching the eventId
      const lesson = await this.lessonRepository.findOne({
        where: {
          tenantId,
          organisationId,
          status: LessonStatus.PUBLISHED,
          media: {
            source: eventId,
            tenantId,
            organisationId
          }
        } as FindOptionsWhere<Lesson>,
        relations: ['media']
      });

      if (!lesson) {
        throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
      }

      // Find the last attempt for this lesson and user
      const lastAttempt = await this.lessonTrackRepository.findOne({
        where: {
          lessonId: lesson.lessonId,
          userId: updateEventProgressDto.userId,
          tenantId,
          organisationId
        } as FindOptionsWhere<LessonTrack>,
        order: {
          attempt: 'DESC'
        }
      });

      if (!lastAttempt) {
        throw new NotFoundException(RESPONSE_MESSAGES.ERROR.TRACKING_NOT_FOUND);
      }

      // Update the attempt with the provided data
      const updateData: Partial<LessonTrack> = {
        status: updateEventProgressDto.status || TrackingStatus.COMPLETED,
        endDatetime: new Date(),
        updatedBy: updateEventProgressDto.userId
      };

      // Add timeSpent if provided
      if (updateEventProgressDto.timeSpent !== undefined) {
        updateData.timeSpent = (lastAttempt.timeSpent || 0) + updateEventProgressDto.timeSpent;
      }

      // Update completion percentage to 100% if marking as completed
      if (updateData.status === TrackingStatus.COMPLETED) {
        updateData.completionPercentage = 100;
      }

      // Apply updates
      Object.assign(lastAttempt, updateData);

      // Save the updated attempt
      const updatedAttempt = await this.lessonTrackRepository.save(lastAttempt);

      // Update course and module tracking if this lesson is part of a course
      if (lesson.courseId) {
        await this.updateCourseTracking(lesson.courseId, updateEventProgressDto.userId, {
          status: TrackingStatus.COMPLETED
        } as UpdateCourseTrackingDto, tenantId, organisationId);
      }

      if (lesson.moduleId) {
        await this.updateModuleTracking(lesson.moduleId, updateEventProgressDto.userId, tenantId, organisationId);
      }

      return updatedAttempt;
    } catch (error) {
      this.logger.error(`Error updating event progress for eventId: ${eventId}, userId: ${updateEventProgressDto.userId}`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error updating lesson progress');
    }
  }
}