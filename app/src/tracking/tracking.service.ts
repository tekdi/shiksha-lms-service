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
import { Lesson, LessonStatus } from '../lessons/entities/lesson.entity';
import { Module, ModuleStatus } from '../modules/entities/module.entity';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { UpdateLessonTrackingDto } from './dto/update-lesson-tracking.dto';
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

    //check if course is completed ,then throw error
    const courseTrack = await this.courseTrackRepository.findOne({
      where: {
        courseId,
        userId,
        tenantId,
        organisationId
      } as FindOptionsWhere<CourseTrack>,
    }); 
    if (courseTrack && courseTrack.status === TrackingStatus.COMPLETED) {
      throw new BadRequestException(RESPONSE_MESSAGES.ERROR.COURSE_COMPLETED);
    }
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

    // Check max attempts
    const maxAttempts = lesson.noOfAttempts || 1;
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
      
      if (latestTrack.status === TrackingStatus.COMPLETED) {
        throw new BadRequestException(RESPONSE_MESSAGES.ERROR.CANNOT_START_COMPLETED);
      }
      // start over
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

    const status: LessonStatusDto = {
      canResume: false,
      canReattempt: false,
      lastAttemptStatus: TrackingStatus.NOT_STARTED,
      lastAttemptId: null
    };

    if (latestTrack) {
      status.lastAttemptId = latestTrack.lessonTrackId;
      status.lastAttemptStatus = latestTrack.status;

      const canResume = lesson.resume ?? true;
      if (canResume && (latestTrack.status === TrackingStatus.STARTED || latestTrack.status === TrackingStatus.INCOMPLETE)) {
        status.canResume = true;
      }

      const maxAttempts = lesson.noOfAttempts || 0;
      if ((maxAttempts === 0 || latestTrack.attempt < maxAttempts) && latestTrack.status === TrackingStatus.COMPLETED) {
        status.canReattempt = true;
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
    attempt.timeSpent = updateProgressDto.timeSpent || 0;
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
      // Get all completed lessons for this course that have considerForPassing = true
      const completedLessonTracksWithConsiderFlag = await this.lessonTrackRepository
        .createQueryBuilder('lessonTrack')
        .innerJoin('lessonTrack.lesson', 'lesson')
        .where('lessonTrack.courseId = :courseId', { courseId: lessonTrack.courseId })
        .andWhere('lessonTrack.userId = :userId', { userId: lessonTrack.userId })
        .andWhere('lessonTrack.status = :status', { status: TrackingStatus.COMPLETED })
        .andWhere('lessonTrack.tenantId = :tenantId', { tenantId })
        .andWhere('lessonTrack.organisationId = :organisationId', { organisationId })
        .andWhere('lesson.considerForPassing = :considerForPassing', { considerForPassing: true })
        .getMany();

      // Get unique lesson IDs
      const uniqueCompletedLessonIds = [...new Set(completedLessonTracksWithConsiderFlag.map(track => track.lessonId))];
      
      // Update course track
      courseTrack.completedLessons = uniqueCompletedLessonIds.length;
      
      // Check if course is completed
      if (courseTrack.completedLessons >= courseTrack.noOfLessons) {
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

    // Get all lessons in this module with considerForPassing = true
    const moduleLessons = await this.lessonRepository.find({
      where: { 
        moduleId,
        tenantId,
        organisationId,
        status: Not(LessonStatus.ARCHIVED),
        considerForPassing: true
      } as FindOptionsWhere<Lesson>,
    });

    // Get completed lessons for this module that have considerForPassing = true
    const completedLessonTracks = await this.lessonTrackRepository
      .createQueryBuilder('lessonTrack')
      .innerJoin('lessonTrack.lesson', 'lesson')
      .where('lessonTrack.lessonId IN (:...lessonIds)', { lessonIds: moduleLessons.map(l => l.lessonId) })
      .andWhere('lessonTrack.userId = :userId', { userId })
      .andWhere('lessonTrack.status = :status', { status: TrackingStatus.COMPLETED })
      .andWhere('lessonTrack.tenantId = :tenantId', { tenantId })
      .andWhere('lessonTrack.organisationId = :organisationId', { organisationId })
      .andWhere('lesson.considerForPassing = :considerForPassing', { considerForPassing: true })
      .getMany();

    // Get unique completed lesson IDs
    const uniqueCompletedLessonIds = [...new Set(completedLessonTracks.map(track => track.lessonId))];

    // Update module tracking data
    moduleTrack.completedLessons = uniqueCompletedLessonIds.length;
    moduleTrack.totalLessons = moduleLessons.length;
    moduleTrack.progress = moduleLessons.length > 0 ? Math.round((uniqueCompletedLessonIds.length / moduleLessons.length) * 100) : 0;

    // Update module status based on completion
    if (uniqueCompletedLessonIds.length === moduleLessons.length && moduleLessons.length > 0) {
      moduleTrack.status = ModuleTrackStatus.COMPLETED;
    } else {
      moduleTrack.status = ModuleTrackStatus.INCOMPLETE;
    }

    await this.moduleTrackRepository.save(moduleTrack);

    } catch (error) {
      throw new BadRequestException(RESPONSE_MESSAGES.ERROR.MODULE_TRACKING_ERROR);
    }
  }
}