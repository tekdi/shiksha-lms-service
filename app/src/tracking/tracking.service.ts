import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindOptionsWhere,
  Not,
  FindManyOptions,
  IsNull,
  In,
} from 'typeorm';
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
import { LMSElasticsearchService } from '../elasticsearch/lms-elasticsearch.service';
import axios from 'axios';
import { CoursesService } from '../courses/courses.service';
import { isElasticsearchEnabled } from '../common/utils/elasticsearch.util';

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
    private readonly lmsElasticsearchService: LMSElasticsearchService, // Injected
    private readonly coursesService: CoursesService, // Injected
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
    organisationId?: string,
  ): Promise<CourseTrack> {
    // Build where clause with required filters
    const whereClause: any = {
      courseId,
      userId,
      tenantId,
      organisationId,
    };

    const courseTrack = await this.courseTrackRepository.findOne({
      where: whereClause,
    });

    if (!courseTrack) {
      throw new NotFoundException(
        RESPONSE_MESSAGES.ERROR.COURSE_TRACKING_NOT_FOUND,
      );
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
    organisationId: string,
  ): Promise<LessonTrack> {
    this.logger.log(`=== STARTING LESSON ATTEMPT ===`);
    this.logger.log(`LessonId: ${lessonId}`);
    this.logger.log(`UserId: ${userId}`);
    this.logger.log(`TenantId: ${tenantId}`);
    this.logger.log(`OrganisationId: ${organisationId}`);

    // Get lesson details first
    this.logger.log(`Fetching lesson details from database...`);
    const lesson = await this.lessonRepository.findOne({
      where: {
        lessonId,
        tenantId,
        organisationId,
      } as FindOptionsWhere<Lesson>,
    });

    if (!lesson) {
      this.logger.error(`❌ Lesson not found: ${lessonId}`);
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
    }

    this.logger.log(`✅ Lesson found: ${lesson.title}`);

    const courseId = lesson.courseId;

    if (!courseId) {
      this.logger.error(`❌ Course ID not found for lesson: ${lessonId}`);
      throw new NotFoundException(
        RESPONSE_MESSAGES.ERROR.COURSE_LESSON_NOT_FOUND,
      );
    }

    this.logger.log(`✅ Course ID found: ${courseId}`);

    // Check prerequisites if any exist
    this.logger.log(`Checking lesson prerequisites...`);
    const prerequisiteCheck = await this.checkLessonsPrerequisites(
      lesson,
      userId,
      courseId,
      tenantId,
      organisationId,
    );

    if (!prerequisiteCheck.isEligible && prerequisiteCheck.requiredLessons) {
      // Get the titles of missing prerequisite lessons for better error message
      const missingPrerequisiteLessons =
        prerequisiteCheck.requiredLessons.filter((l) => !l.completed);
      const missingLessonTitles = missingPrerequisiteLessons
        .map((l) => l.title)
        .join(', ');
      this.logger.error(
        `❌ Prerequisites not completed: ${missingLessonTitles}`,
      );
      throw new BadRequestException(
        `Cannot start lesson. Prerequisites not completed: ${missingLessonTitles}. Please complete the required lessons first.`,
      );
    }

    this.logger.log(`✅ Prerequisites check passed`);
    //check if course is completed ,then throw error
    this.logger.log(`Checking if course is completed...`);
    const courseTrack = await this.courseTrackRepository.findOne({
      where: {
        courseId,
        userId,
        tenantId,
        organisationId,
      } as FindOptionsWhere<CourseTrack>,
    });
    if (courseTrack && courseTrack.status === TrackingStatus.COMPLETED) {
      this.logger.error(`❌ Course is already completed: ${courseId}`);
      throw new BadRequestException(RESPONSE_MESSAGES.ERROR.COURSE_COMPLETED);
    }
    this.logger.log(`✅ Course is not completed`);
    // Find existing tracks for course lesson
    this.logger.log(`Finding existing lesson tracks...`);
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

    this.logger.log(`Found ${existingTracks.length} existing tracks`);

    // If there's an incomplete attempt, return it
    const incompleteAttempt = existingTracks.find(
      (track) => track.status !== TrackingStatus.COMPLETED,
    );
    if (incompleteAttempt) {
      //check can resume
      const canResume = lesson.resume ?? true;
      if (canResume) {
        this.logger.log(
          `✅ Found incomplete attempt, returning existing attempt: ${incompleteAttempt.lessonTrackId}`,
        );

        // Sync with Elasticsearch for existing attempt
        try {
          this.logger.log(`🔄 Syncing existing attempt with Elasticsearch...`);
          await this.lmsElasticsearchService.handleLessonAttemptData(
            incompleteAttempt.lessonTrackId,
            userId,
            tenantId,
            organisationId,
          );
          this.logger.log(
            `✅ Elasticsearch sync completed for existing attempt`,
          );
        } catch (error) {
          this.logger.error(
            `❌ Elasticsearch sync failed for existing attempt: ${error.message}`,
          );
          // Don't throw error, just log it
        }

        return incompleteAttempt;
      }
    }

    this.logger.log(
      `No incomplete attempts found, proceeding with new attempt`,
    );

    // Check max attempts
    const maxAttempts = lesson.noOfAttempts || 1;
    if (
      maxAttempts > 0 &&
      existingTracks.length > 0 &&
      existingTracks[0].attempt >= maxAttempts
    ) {
      throw new BadRequestException(
        RESPONSE_MESSAGES.ERROR.MAX_ATTEMPTS_REACHED,
      );
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
      timeSpent: 0,
    });
    //update course tracking and module tracking as here new attempt is started
    await this.updateCourseAndModuleTracking(
      lessonTrack,
      tenantId,
      organisationId,
    );
    const savedLessonTrack = await this.lessonTrackRepository.save(lessonTrack);

    this.logger.log(
      `✅ Lesson track saved with ID: ${savedLessonTrack.lessonTrackId}`,
    );

    // --- ELASTICSEARCH SYNC: Update lesson tracking in user's Elasticsearch document ---
    this.logger.log(`=== STARTING ELASTICSEARCH SYNC SECTION ===`);

    try {
      this.logger.log(
        `Starting Elasticsearch sync for lesson attempt: lessonId=${lessonId}, userId=${userId}, courseId=${courseId}`,
      );

      // Test if the service is properly injected
      if (!this.lmsElasticsearchService) {
        this.logger.error(`❌ LMS Elasticsearch service is not injected!`);
        return savedLessonTrack;
      }

      this.logger.log(`✅ LMS Elasticsearch service is properly injected`);
      this.logger.log(`About to call handleLessonAttemptData with:`);
      this.logger.log(`  - attemptId: ${savedLessonTrack.lessonTrackId}`);
      this.logger.log(`  - userId: ${userId}`);
      this.logger.log(`  - tenantId: ${tenantId}`);
      this.logger.log(`  - organisationId: ${organisationId}`);

      // Call the LMS Elasticsearch service to update lesson tracking
      await this.lmsElasticsearchService.handleLessonAttemptData(
        savedLessonTrack.lessonTrackId, // Use the saved lesson track ID as attempt ID
        userId,
        tenantId,
        organisationId,
      );

      this.logger.log(
        `✅ Successfully synced lesson attempt to Elasticsearch: lessonId=${lessonId}, userId=${userId}`,
      );
    } catch (elasticsearchError) {
      this.logger.error(
        `❌ Failed to sync lesson attempt to Elasticsearch: lessonId=${lessonId}, userId=${userId}`,
      );
      this.logger.error(`Error details:`, elasticsearchError);
      // Don't fail the main operation if Elasticsearch sync fails
    }

    this.logger.log(`=== COMPLETED ELASTICSEARCH SYNC SECTION ===`);
    // --- END ELASTICSEARCH SYNC ---

    this.logger.log(`=== COMPLETED LESSON ATTEMPT ===`);
    this.logger.log(
      `Returning lesson track: ${savedLessonTrack.lessonTrackId}`,
    );

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
    organisationId: string,
  ): Promise<{ isEligible: boolean; requiredLessons: any[] }> {
    if (!lesson.prerequisites || lesson.prerequisites.length === 0) {
      return {
        isEligible: true,
        requiredLessons: [],
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
          status: LessonStatus.PUBLISHED,
        },
        select: ['lessonId', 'title'],
      });

      if (!requiredLesson) {
        // If required lesson doesn't exist, consider it as not completed
        requiredLessons.push({
          lessonId: requiredLessonId,
          title: 'Unknown Lesson',
          completed: false,
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
          status: TrackingStatus.COMPLETED,
        } as FindOptionsWhere<LessonTrack>,
      });

      const isCompleted = !!completedTrack;

      requiredLessons.push({
        lessonId: requiredLessonId,
        title: requiredLesson.title,
        completed: isCompleted,
      });

      if (!isCompleted) {
        allCompleted = false;
      }
    }

    return {
      isEligible: allCompleted,
      requiredLessons,
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
    organisationId: string,
  ): Promise<LessonTrack> {
    // Get lesson details first
    const lesson = await this.lessonRepository.findOne({
      where: {
        lessonId,
        tenantId,
        organisationId,
      } as FindOptionsWhere<Lesson>,
    });

    if (!lesson) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
    }

    const courseId = lesson.courseId;

    if (!courseId) {
      throw new NotFoundException(
        RESPONSE_MESSAGES.ERROR.COURSE_LESSON_NOT_FOUND,
      );
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
        throw new BadRequestException(
          RESPONSE_MESSAGES.ERROR.RESUME_NOT_ALLOWED,
        );
      }
      if (latestTrack.status === TrackingStatus.COMPLETED) {
        throw new BadRequestException(
          RESPONSE_MESSAGES.ERROR.CANNOT_RESUME_COMPLETED,
        );
      }

      // --- ELASTICSEARCH SYNC: Update lesson tracking for resume ---
      try {
        this.logger.log(
          `Starting Elasticsearch sync for lesson resume: lessonId=${lessonId}, userId=${userId}, attemptId=${latestTrack.lessonTrackId}`,
        );

        await this.lmsElasticsearchService.handleLessonAttemptData(
          latestTrack.lessonTrackId,
          userId,
          tenantId,
          organisationId,
        );

        this.logger.log(
          `Successfully synced lesson resume to Elasticsearch: lessonId=${lessonId}, userId=${userId}`,
        );
      } catch (elasticsearchError) {
        this.logger.error(
          `Failed to sync lesson resume to Elasticsearch: lessonId=${lessonId}, userId=${userId}`,
          elasticsearchError,
        );
        // Don't fail the main operation if Elasticsearch sync fails
      }
      // --- END ELASTICSEARCH SYNC ---

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

        const savedTracking =
          await this.lessonTrackRepository.save(latestTrack);
        return savedTracking;
      }

      if (latestTrack.status === TrackingStatus.COMPLETED) {
        throw new BadRequestException(
          RESPONSE_MESSAGES.ERROR.CANNOT_START_COMPLETED,
        );
      }

      // Check max attempts
      const maxAttempts = lesson.noOfAttempts || 1;
      if (maxAttempts > 0 && latestTrack.attempt >= maxAttempts) {
        throw new BadRequestException(
          RESPONSE_MESSAGES.ERROR.MAX_ATTEMPTS_REACHED,
        );
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
        timeSpent: 0,
      });

      const savedTracking = await this.lessonTrackRepository.save(lessonTrack);

      // --- ELASTICSEARCH SYNC: Update lesson tracking for start over ---
      try {
        this.logger.log(
          `Starting Elasticsearch sync for lesson start over: lessonId=${lessonId}, userId=${userId}, attemptId=${savedTracking.lessonTrackId}`,
        );

        await this.lmsElasticsearchService.handleLessonAttemptData(
          savedTracking.lessonTrackId,
          userId,
          tenantId,
          organisationId,
        );

        this.logger.log(
          `Successfully synced lesson start over to Elasticsearch: lessonId=${lessonId}, userId=${userId}`,
        );
      } catch (elasticsearchError) {
        this.logger.error(
          `Failed to sync lesson start over to Elasticsearch: lessonId=${lessonId}, userId=${userId}`,
          elasticsearchError,
        );
        // Don't fail the main operation if Elasticsearch sync fails
      }
      // --- END ELASTICSEARCH SYNC ---

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
    organisationId: string,
  ): Promise<LessonStatusDto> {
    // Get lesson
    const lesson = await this.lessonRepository.findOne({
      where: {
        lessonId,
        tenantId,
        organisationId,
        status: Not(LessonStatus.ARCHIVED),
      } as FindOptionsWhere<Lesson>,
    });

    if (!lesson) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
    }

    if (!lesson.courseId) {
      throw new NotFoundException(
        RESPONSE_MESSAGES.ERROR.COURSE_LESSON_NOT_FOUND,
      );
    }

    // Find latest attempt
    const latestTrack = await this.lessonTrackRepository.findOne({
      where: {
        lessonId,
        userId,
        courseId: lesson.courseId,
        tenantId,
        organisationId,
      } as FindOptionsWhere<LessonTrack>,
      order: { attempt: 'DESC' },
    });

    //check lesson prerequisites
    const prerequisiteCheck = await this.checkLessonsPrerequisites(
      lesson,
      userId,
      lesson.courseId,
      tenantId,
      organisationId,
    );

    const status: LessonStatusDto = {
      canResume: false,
      canReattempt: false,
      lastAttemptStatus: TrackingStatus.NOT_STARTED,
      lastAttemptId: null,
      isEligible: prerequisiteCheck.isEligible,
      requiredLessons: prerequisiteCheck.requiredLessons,
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
        if (
          canResume &&
          (latestTrack.status === TrackingStatus.STARTED ||
            latestTrack.status === TrackingStatus.INCOMPLETE)
        ) {
          status.canResume = true;
        }

        const maxAttempts = lesson.noOfAttempts || 0;
        if (
          (maxAttempts === 0 || latestTrack.attempt < maxAttempts) &&
          latestTrack.status === TrackingStatus.COMPLETED
        ) {
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
    organisationId: string,
  ): Promise<LessonTrack> {
    const attempt = await this.lessonTrackRepository.findOne({
      where: {
        lessonTrackId: attemptId,
        userId,
        tenantId,
        organisationId,
      } as FindOptionsWhere<LessonTrack>,
      relations: ['lesson', 'lesson.media'],
    });

    if (!attempt) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.ATTEMPT_NOT_FOUND);
    }

    // Add Elasticsearch functionality in try-catch block before return
    try {
      await this.lmsElasticsearchService.handleLessonAttemptData(
        attemptId,
        userId,
        tenantId,
        organisationId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle Elasticsearch data for attemptId: ${attemptId}, userId: ${userId}:`,
        error,
      );
      // Don't throw error to avoid breaking the main flow
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
    organisationId: string,
  ): Promise<LessonTrack> {
    const attempt = await this.lessonTrackRepository.findOne({
      where: {
        lessonTrackId: attemptId,
        userId,
        tenantId,
        organisationId,
      } as FindOptionsWhere<LessonTrack>,
    });

    if (!attempt) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.ATTEMPT_NOT_FOUND);
    }

    // Update progress
    attempt.currentPosition = updateProgressDto.currentPosition || 0;
    attempt.score = updateProgressDto.score || 0;
    attempt.timeSpent =
      (attempt.timeSpent || 0) + (updateProgressDto.timeSpent || 0);
    attempt.totalContent = updateProgressDto.totalContent || 0;

    // Update completion percentage if provided
    if (updateProgressDto.completionPercentage !== undefined) {
      attempt.completionPercentage = updateProgressDto.completionPercentage;
    } else if (
      updateProgressDto.currentPosition &&
      updateProgressDto.totalContent
    ) {
      // Calculate completion percentage if not provided but position and total content are available
      attempt.completionPercentage = Math.round(
        (updateProgressDto.currentPosition / updateProgressDto.totalContent) *
          100,
      );
    }

    // Update params if provided
    if (updateProgressDto.params) {
      attempt.params = updateProgressDto.params;
    }

    // Update status if completed
    if (
      updateProgressDto.currentPosition === updateProgressDto.totalContent ||
      (updateProgressDto.completionPercentage !== undefined &&
        updateProgressDto.completionPercentage >= 100) ||
      updateProgressDto.status === TrackingStatus.COMPLETED
    ) {
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
      await this.updateCourseAndModuleTracking(
        savedAttempt,
        tenantId,
        organisationId,
      );
    }

    // --- ELASTICSEARCH SYNC: Update lesson progress tracking in user's Elasticsearch document ---
    try {
      this.logger.log(
        `🔄 Starting Elasticsearch progress sync for attemptId: ${attemptId}, userId: ${userId}, lessonId: ${savedAttempt.lessonId}`,
      );
      this.logger.log(
        `📊 Progress data - Status: ${savedAttempt.status}, Completion: ${savedAttempt.completionPercentage}%, TimeSpent: ${savedAttempt.timeSpent}s`,
      );

      // Call the LMS Elasticsearch service to update lesson progress tracking
      await this.lmsElasticsearchService.handleTrackingProgressUpdate(
        userId,
        savedAttempt.lessonId,
        attemptId,
        tenantId,
        organisationId,
      );

      this.logger.log(
        `✅ Successfully synced lesson progress to Elasticsearch: attemptId=${attemptId}, userId=${userId}, lessonId=${savedAttempt.lessonId}`,
      );
    } catch (elasticsearchError) {
      this.logger.error(
        `❌ Failed to sync lesson progress to Elasticsearch: attemptId=${attemptId}, userId=${userId}`,
        elasticsearchError,
      );
      this.logger.error(`❌ Error details: ${elasticsearchError.message}`);
      // Don't fail the main operation if Elasticsearch sync fails
    }
    // --- END ELASTICSEARCH SYNC ---

    return savedAttempt;
  }

  /**
   * Helper method to update course and module tracking
   */
  private async updateCourseAndModuleTracking(
    lessonTrack: LessonTrack,
    tenantId: string,
    organisationId: string,
  ): Promise<void> {
    if (!lessonTrack.courseId) {
      return;
    }

    // Get course track
    let courseTrack = await this.courseTrackRepository.findOne({
      where: {
        courseId: lessonTrack.courseId,
        userId: lessonTrack.userId,
        tenantId,
        organisationId,
      } as FindOptionsWhere<CourseTrack>,
    });

    if (!courseTrack) {
      throw new NotFoundException(
        RESPONSE_MESSAGES.ERROR.COURSE_TRACKING_NOT_FOUND,
      );
    }

    // Update course track
    courseTrack.lastAccessedDate = new Date();

    // If the lesson is completed, update completed lessons count
    if (
      lessonTrack.status === TrackingStatus.COMPLETED ||
      courseTrack.status === TrackingStatus.STARTED
    ) {
      // Get all completed lessons for this course that have considerForPassing = true
      const completedLessonTracksWithConsiderFlag =
        await this.lessonTrackRepository
          .createQueryBuilder('lessonTrack')
          .innerJoin('lessonTrack.lesson', 'lesson')
          .where('lessonTrack.courseId = :courseId', {
            courseId: lessonTrack.courseId,
          })
          .andWhere('lessonTrack.userId = :userId', {
            userId: lessonTrack.userId,
          })
          .andWhere('lessonTrack.status = :status', {
            status: TrackingStatus.COMPLETED,
          })
          .andWhere('lessonTrack.tenantId = :tenantId', { tenantId })
          .andWhere('lessonTrack.organisationId = :organisationId', {
            organisationId,
          })
          .andWhere('lesson.considerForPassing = :considerForPassing', {
            considerForPassing: true,
          })
          .getMany();

      // Get unique lesson IDs
      const uniqueCompletedLessonIds = [
        ...new Set(
          completedLessonTracksWithConsiderFlag.map((track) => track.lessonId),
        ),
      ];

      // Update course track
      courseTrack.completedLessons = uniqueCompletedLessonIds.length;

      // Check if course is completed
      // if (courseTrack.completedLessons >= courseTrack.noOfLessons) {
      //   courseTrack.status = TrackingStatus.COMPLETED;
      //   courseTrack.endDatetime = new Date();

      // } else {
      courseTrack.status = TrackingStatus.INCOMPLETE;
      // }
    }
    await this.courseTrackRepository.save(courseTrack);

    // Find and update module tracking if applicable
    const lesson = await this.lessonRepository.findOne({
      where: {
        lessonId: lessonTrack.lessonId,
      } as FindOptionsWhere<Lesson>,
    });

    if (lesson && lesson.moduleId) {
      await this.updateModuleTracking(
        lesson.moduleId,
        lessonTrack.userId,
        lessonTrack.tenantId,
        lessonTrack.organisationId,
      );
    }
  }

  /**
   * Helper method to update module tracking
   */
  private async updateModuleTracking(
    moduleId: string,
    userId: string,
    tenantId: string,
    organisationId: string,
  ): Promise<void> {
    try {
      // Get module
      const module = await this.moduleRepository.findOne({
        where: {
          moduleId,
          tenantId,
          organisationId,
          status: Not(ModuleStatus.ARCHIVED as any),
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
          organisationId,
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
          status: LessonStatus.PUBLISHED,
          considerForPassing: true,
        } as FindOptionsWhere<Lesson>,
      });

      // Get completed lessons for this module that have considerForPassing = true
      const completedLessonTracks = await this.lessonTrackRepository
        .createQueryBuilder('lessonTrack')
        .innerJoin('lessonTrack.lesson', 'lesson')
        .where('lessonTrack.lessonId IN (:...lessonIds)', {
          lessonIds: moduleLessons.map((l) => l.lessonId),
        })
        .andWhere('lessonTrack.userId = :userId', { userId })
        .andWhere('lessonTrack.status = :status', {
          status: TrackingStatus.COMPLETED,
        })
        .andWhere('lessonTrack.tenantId = :tenantId', { tenantId })
        .andWhere('lessonTrack.organisationId = :organisationId', {
          organisationId,
        })
        .andWhere('lesson.considerForPassing = :considerForPassing', {
          considerForPassing: true,
        })
        .getMany();

      // Get unique completed lesson IDs
      const uniqueCompletedLessonIds = [
        ...new Set(completedLessonTracks.map((track) => track.lessonId)),
      ];

      // Update module tracking data
      moduleTrack.completedLessons = uniqueCompletedLessonIds.length;
      moduleTrack.totalLessons = moduleLessons.length;
      moduleTrack.progress =
        moduleLessons.length > 0
          ? Math.round(
              (uniqueCompletedLessonIds.length / moduleLessons.length) * 100,
            )
          : 0;

      // Update module status based on completion
      if (
        uniqueCompletedLessonIds.length === moduleLessons.length &&
        moduleLessons.length > 0
      ) {
        moduleTrack.status = ModuleTrackStatus.COMPLETED;
      } else {
        moduleTrack.status = ModuleTrackStatus.INCOMPLETE;
      }

      await this.moduleTrackRepository.save(moduleTrack);
    } catch (error) {
      throw new BadRequestException(
        RESPONSE_MESSAGES.ERROR.MODULE_TRACKING_ERROR,
      );
    }
  }
}
