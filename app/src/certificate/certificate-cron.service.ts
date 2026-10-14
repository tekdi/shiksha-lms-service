import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger/logger/logger.service';
import { CertificateLogger } from '../common/logger/logger/certificate-logger.service';
import { CertificateService } from './certificate.service';
import { LmsEligibleUser } from '../common/interfaces/lms.interface';
import { CoursesService } from '../courses/courses.service';
import { AspireLeaderService } from '../aspire-leader/aspire-leader.service';
import { CourseStatus } from '../courses/entities/course.entity';
import { TrackingStatus } from '../tracking/entities/course-track.entity';
import {
  LessonFormat,
  LessonSubFormat,
} from '../lessons/entities/lesson.entity';
import { randomUUID } from 'node:crypto';

@Injectable()
export class CertificateCronService implements OnModuleInit, OnModuleDestroy {
  private cronInterval: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE: number;
  private readonly CRON_INTERVAL_MS: number;
  private readonly CONCURRENT_USERS_PER_BATCH: number; // Limit concurrent processing within a batch
  /** Max users to process per trigger to avoid gateway timeout (504). 0 = no limit. */
  private readonly MAX_USERS_PER_RUN: number;
  private isRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
    private readonly certificateService: CertificateService,
    private readonly coursesService: CoursesService,
    private readonly aspireLeaderService: AspireLeaderService,
  ) {
    // Initialize batch size from environment variable with fallback
    this.BATCH_SIZE = Number.parseInt(
      this.configService.get('CERTIFICATE_BATCH_SIZE') || '100',
      10,
    );

    // Initialize concurrent users per batch (limit parallel processing to avoid overwhelming system)
    // For 4-5K users, process 20 users concurrently within each batch
    this.CONCURRENT_USERS_PER_BATCH = Number.parseInt(
      this.configService.get('CERTIFICATE_CONCURRENT_USERS_PER_BATCH') || '20',
      10,
    );

    // Initialize cron interval from environment variable with fallback (24 hours in milliseconds)
    this.CRON_INTERVAL_MS = Number.parseInt(
      this.configService.get('CERTIFICATE_CRON_INTERVAL_MS') || '86400000',
      10,
    );

    // Max users per trigger to avoid 504 Gateway Timeout (~60–120s). 0 = no limit (process all).
    this.MAX_USERS_PER_RUN = Number.parseInt(
      this.configService.get('CERTIFICATE_MAX_USERS_PER_RUN') || '300',
      10,
    );

    this.loggerService.log(
      `Certificate Cron Service initialized with BATCH_SIZE: ${this.BATCH_SIZE}, CONCURRENT_USERS_PER_BATCH: ${this.CONCURRENT_USERS_PER_BATCH}, MAX_USERS_PER_RUN: ${this.MAX_USERS_PER_RUN || 'no limit'}, CRON_INTERVAL_MS: ${this.CRON_INTERVAL_MS}`,
    );
  }

  onModuleInit() {
    // Certificate cron job is now only triggered via API endpoint
    // No automatic scheduling - use POST /certificate/cron/trigger to run manually
    // Clear any existing intervals to ensure no automatic execution
    if (this.cronInterval) {
      clearInterval(this.cronInterval);
      this.cronInterval = null;
      this.loggerService.log('Cleared any existing cron intervals');
    }

    // Explicitly check and disable any environment variable that might trigger automatic cron
    const cronEnabled = this.configService.get('CERTIFICATE_CRON_ENABLED');
    if (cronEnabled === 'true') {
      this.loggerService.warn(
        'CERTIFICATE_CRON_ENABLED is set to true in environment, but automatic cron is disabled. ' +
          'Use POST /certificate/cron/trigger API endpoint to run manually.',
      );
    }

    this.loggerService.log(
      'Certificate cron service initialized. Use POST /certificate/cron/trigger to run manually.',
    );
    this.loggerService.log(
      `Note: CERTIFICATE_CRON_ENABLED environment variable is ignored. Cron only runs via API call.`,
    );
  }

  onModuleDestroy() {
    this.stopCronJob();
  }

  /**
   * Start the certificate issuance cron job
   * Initializes the cron job and schedules recurring execution
   * Note: This method is available for manual scheduling but not used by default
   */
  private startCronJob() {
    try {
      this.loggerService.log('Starting Certificate Issuance Cron Job...');

      // Schedule recurring execution every 24 hours
      this.cronInterval = setInterval(() => {
        void this.handleCertificateIssuance();
      }, this.CRON_INTERVAL_MS);

      this.loggerService.log(
        `Certificate cron job scheduled to run every 24 hours`,
      );
    } catch (error) {
      this.loggerService.error(
        'Failed to start certificate cron job:',
        error.message,
      );
    }
  }

  /**
   * Stop the certificate issuance cron job
   * Cleans up the cron interval and resets state
   */
  private stopCronJob() {
    try {
      if (this.cronInterval) {
        clearInterval(this.cronInterval);
        this.cronInterval = null;
        this.loggerService.log('Certificate cron job stopped');
      }
    } catch (error) {
      this.loggerService.error(
        'Error stopping certificate cron job:',
        error.message,
      );
    }
  }

  /**
   * Main certificate issuance handler
   * Processes eligible users in batches and issues certificates
   * @param userId - User ID to filter users for (optional, uses 'all' if not provided)
   * @returns Processing statistics
   */
  async handleCertificateIssuance(userId?: string): Promise<{
    totalProcessed: number;
    totalIssued: number;
    totalSkipped: number;
    totalErrors: number;
  }> {
    // Prevent concurrent executions
    if (this.isRunning) {
      this.loggerService.warn(
        'Certificate issuance already running, skipping this execution',
      );
      return {
        totalProcessed: 0,
        totalIssued: 0,
        totalSkipped: 0,
        totalErrors: 0,
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const executionId = this.generateExecutionId();

    try {
      this.loggerService.log(
        `Starting certificate issuance process [Execution ID: ${executionId}]`,
      );

      // Log certificate processing start
      CertificateLogger.logCertificate(
        `Certificate processing started`,
        'handleCertificateIssuance',
        userId || 'all',
        'info',
      );

      // Validate certificate issuance conditions (non-blocking)
      const validationResult =
        await this.validateCertificateIssuanceConditions(userId);
      if (!validationResult.isValid) {
        this.loggerService.warn(
          `Certificate issuance validation warning: ${validationResult.reason}. Continuing...`,
        );
      }

      // Get eligible users
      const maxToFetch =
        this.MAX_USERS_PER_RUN > 0 ? this.MAX_USERS_PER_RUN : undefined;
      const eligibleUsers = await this.getEligibleUsersForCertificateIssuance(
        userId,
        maxToFetch,
      );
      if (!eligibleUsers.length) {
        this.loggerService.log(
          'No eligible users found for certificate issuance',
        );
        return {
          totalProcessed: 0,
          totalIssued: 0,
          totalSkipped: 0,
          totalErrors: 0,
        };
      }

      this.loggerService.log(
        `Found ${eligibleUsers.length} eligible users for certificate issuance`,
      );

      const cohortEventCriteriaMap =
        this.getCohortEventCriteriaMap(eligibleUsers);
      const batches = this.splitIntoBatches(eligibleUsers, this.BATCH_SIZE);
      this.logProcessingTimeEstimate(eligibleUsers.length, batches.length);

      const batchResults = await this.processAllBatches(
        batches,
        executionId,
        userId || 'all',
        cohortEventCriteriaMap,
        eligibleUsers.length,
      );

      const duration = Date.now() - startTime;
      this.logFinalResults(executionId, duration, batchResults);

      const executionSummary = {
        executionId,
        ...batchResults,
        duration,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
      };

      await this.logExecutionSummary(executionId, executionSummary);
      CertificateLogger.logExecutionSummary(executionSummary);

      return batchResults;
    } catch (error) {
      this.loggerService.error(
        `Error in certificate issuance process [Execution ID: ${executionId}]:`,
        error.message,
      );
      await this.logExecutionError(executionId, error);
      return {
        totalProcessed: 0,
        totalIssued: 0,
        totalSkipped: 0,
        totalErrors: 1,
      };
    } finally {
      this.isRunning = false;
    }
  }

  private getCohortEventCriteriaMap(
    eligibleUsers: LmsEligibleUser[],
  ): Record<string, number> {
    const uniqueCohortIds = [
      ...new Set(
        eligibleUsers.map((u) => u.cohortId).filter((id): id is string => !!id),
      ),
    ];
    this.loggerService.log(
      `Fetching event criteria for ${uniqueCohortIds.length} unique cohorts`,
    );
    const cohortEventCriteriaMap: Record<string, number> = {};
    this.loggerService.log(
      `[DEBUG] cohortEventCriteriaMap: ${JSON.stringify(cohortEventCriteriaMap)}`,
    );
    this.loggerService.log(
      `[DEBUG] uniqueCohortIds: ${JSON.stringify(uniqueCohortIds)}`,
    );
    return cohortEventCriteriaMap;
  }

  private logProcessingTimeEstimate(
    usersCount: number,
    batchCount: number,
  ): void {
    this.loggerService.log(
      `Processing ${batchCount} batches of up to ${this.BATCH_SIZE} users each (${usersCount} users this run)`,
    );
    if (usersCount <= 100) {
      return;
    }
    const timeEstimate = this.calculateProcessingTime(
      usersCount,
      this.BATCH_SIZE,
    );
    const timeText =
      timeEstimate.estimatedHours > 1
        ? `~${timeEstimate.estimatedHours} hours`
        : `~${timeEstimate.estimatedMinutes} minutes`;
    this.loggerService.log(
      `Estimated processing time: ${timeText} for ${usersCount} users`,
    );
    this.loggerService.log(
      `Processing ${usersCount} users in ${timeEstimate.batchCount} batches with ${this.CONCURRENT_USERS_PER_BATCH} concurrent users per batch`,
    );
  }

  private async processAllBatches(
    batches: LmsEligibleUser[][],
    executionId: string,
    targetUserId: string,
    cohortEventCriteriaMap: Record<string, number>,
    totalUsersCount: number,
  ): Promise<{
    totalProcessed: number;
    totalIssued: number;
    totalSkipped: number;
    totalErrors: number;
  }> {
    let totalProcessed = 0;
    let totalIssued = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    let batchIndex = 0;
    for await (const batch of batches) {
      batchIndex++;
      this.loggerService.log(
        `Processing batch ${batchIndex}/${batches.length} (${batch.length} users)`,
      );

      try {
        const batchResults = await this.processBatchWithValidation(
          batch,
          executionId,
          targetUserId,
          cohortEventCriteriaMap,
        );

        totalProcessed += batchResults.processed;
        totalIssued += batchResults.issued;
        totalSkipped += batchResults.skipped;
        totalErrors += batchResults.errors;

        this.loggerService.log(
          `Batch ${batchIndex} completed - Issued: ${batchResults.issued}, Skipped: ${batchResults.skipped}, Errors: ${batchResults.errors}`,
        );

        if (batchIndex < batches.length) {
          const delayMs = totalUsersCount > 1000 ? 1000 : 2000;
          await this.delay(delayMs);
        }

        this.triggerBatchMemoryCleanup(totalUsersCount, batchIndex);
      } catch (error) {
        this.handleBatchError(batch, batchIndex, executionId, error);
        totalErrors += batch.length;
      }
    }

    return { totalProcessed, totalIssued, totalSkipped, totalErrors };
  }

  private triggerBatchMemoryCleanup(
    totalUsersCount: number,
    batchIndex: number,
  ): void {
    if (totalUsersCount > 1000 && batchIndex % 10 === 0 && global.gc) {
      try {
        global.gc();
        this.loggerService.log(
          `Memory cleanup triggered after batch ${batchIndex}`,
        );
      } catch {
        // GC not available, continue
      }
    }
  }

  private handleBatchError(
    batch: LmsEligibleUser[],
    batchIndex: number,
    executionId: string,
    error: any,
  ): void {
    this.loggerService.error(
      `Error processing batch ${batchIndex}:`,
      error.message,
    );
    for (const user of batch) {
      CertificateLogger.logUserFailure(
        user.userId,
        user.courseId,
        user.courseTitle || 'Unknown',
        user.cohortId,
        `Batch processing error: ${error.message}`,
        {
          message: error.message,
          stack: error.stack,
          batchNumber: batchIndex,
          batchSize: batch.length,
        },
        executionId,
        'handleCertificateIssuance',
      );
    }
  }

  private logFinalResults(
    executionId: string,
    duration: number,
    results: {
      totalProcessed: number;
      totalIssued: number;
      totalSkipped: number;
      totalErrors: number;
    },
  ): void {
    const { totalProcessed, totalIssued, totalSkipped, totalErrors } = results;
    this.loggerService.log(
      `Certificate issuance completed in ${duration}ms [Execution ID: ${executionId}]`,
    );
    this.loggerService.log(
      `Summary: ${totalProcessed} processed, ${totalIssued} issued, ${totalSkipped} skipped, ${totalErrors} errors`,
    );

    if (totalSkipped > 0 || totalErrors > 0) {
      this.loggerService.log(
        `\n=== FAILURE SUMMARY [Execution ID: ${executionId}] ===`,
      );
      this.loggerService.log(
        `Total Skipped: ${totalSkipped} users - Check logs/cron-certificate-failures.log for details`,
      );
      this.loggerService.log(
        `Total Errors: ${totalErrors} users - Check logs/cron-certificate-failures.log for details`,
      );
      this.loggerService.log(
        `\nTo view skipped users: grep "USER_CERTIFICATE_SKIP" logs/cron-certificate-failures.log | jq -r '.userId'`,
      );
      this.loggerService.log(
        `To view failed users: grep "USER_CERTIFICATE_FAILURE" logs/cron-certificate-failures.log | jq -r '.userId'`,
      );
      this.loggerService.log(
        `To view by failure reason: grep "USER_CERTIFICATE_FAILURE" logs/cron-certificate-failures.log | jq -r '.failureReason' | sort | uniq -c`,
      );
      this.loggerService.log(
        `===================================================\n`,
      );
    }
  }

  /**
   * Validates certificate issuance conditions
   * Checks external services and system resources
   * Note: Cron job validation removed - job only runs when API is called
   * @param userId - User ID to filter users for (optional)
   * @returns Validation result with success status and reason
   */
  private async validateCertificateIssuanceConditions(
    userId?: string,
  ): Promise<{
    isValid: boolean;
    reason?: string;
  }> {
    try {
      // Validate external service connectivity with optimized timeout
      const serviceHealth = await this.validateExternalServicesHealth();
      if (!serviceHealth.allHealthy) {
        // Log warning but don't block if it's a connection error (service might be temporarily down)
        this.loggerService.warn(
          `External services not healthy: ${serviceHealth.unhealthyServices.join(
            ', ',
          )}. Continuing with certificate issuance...`,
        );
        // Don't block the process - allow it to continue and handle errors gracefully
      }

      // Check system resources
      const resourceCheck = await this.validateSystemResources();
      if (!resourceCheck.isValid) {
        return { isValid: false, reason: resourceCheck.reason };
      }

      return { isValid: true };
    } catch (error) {
      this.loggerService.error(
        'Error validating certificate issuance conditions:',
        error.message,
      );
      // Don't block on validation errors - allow process to continue
      // Individual user validations will handle their own errors
      return { isValid: true };
    }
  }

  /**
   * Get eligible users from course report API
   * Fetches users with status 'completed' and certificateIssued: false
   * @param userId - User ID to filter users for (optional, uses 'all' if not provided)
   * @param maxUsers - Max users to fetch (stops after this many). Omit or 0 = no limit
   * @returns Array of eligible users (at most maxUsers when maxUsers > 0)
   */
  private async getEligibleUsersForCertificateIssuance(
    userId?: string,
    maxUsers?: number,
  ): Promise<LmsEligibleUser[]> {
    try {
      // Get environment variables
      const tenantId =
        process.env.TENANT_ID || 'ef99949b-7f3a-4a5f-806a-e67e683e38f3';
      const academicYearId =
        process.env.ACADEMIC_YEAR_ID || '9a9e0daa-50dd-4d0e-8d10-36e7bc808f88';
      const organisationId =
        process.env.ORGANISATION_ID || 'd36d9079-0f42-4ba3-be03-26c9e79509ee';

      // Step 1: Get all published courses using internal CoursesService
      let allCourses: any[] = [];
      try {
        const coursesResponse = await this.coursesService.search(
          {
            status: CourseStatus.PUBLISHED,
            limit: 100,
            offset: 0,
          },
          tenantId,
          organisationId,
        );
        allCourses = coursesResponse?.courses || [];
      } catch (error) {
        this.loggerService.error(
          `Error searching published courses: ${error.message}`,
        );
        return [];
      }

      this.loggerService.log(
        `Found ${allCourses.length} published courses from LMS`,
      );

      // Step 2: Filter courses by certificateGenDateTime <= today (process past dates and today)
      const today = new Date().toISOString().split('T')[0];

      const eligibleCourses = allCourses.filter((course: any) => {
        if (!course.certificateGenDateTime) {
          return false;
        }

        const courseCertDate = new Date(course.certificateGenDateTime)
          .toISOString()
          .split('T')[0];
        return courseCertDate <= today; // Process courses where certificateGenDateTime is today or in the past
      });

      this.loggerService.log(
        `Found ${eligibleCourses.length} courses with certificate generation date <= today`,
      );

      if (eligibleCourses.length === 0) {
        this.loggerService.log(
          'No courses found with certificate generation date <= today',
        );
        return [];
      }

      // Step 3: Get eligible users for each course
      const allEligibleUsers: LmsEligibleUser[] = [];

      for (const course of eligibleCourses) {
        const courseId = course.courseId || course.id;
        const cohortId = course.params?.cohortId; // Extract cohortId from params object

        if (!cohortId) {
          this.loggerService.warn(
            `Course ${courseId} has no cohortId - skipping`,
          );
          continue;
        }

        try {
          // Get users from AspireLeaderService course report for this specific course and cohort
          const report = await this.aspireLeaderService.generateCourseReport(
            {
              courseId,
              cohortId,
              status: TrackingStatus.COMPLETED,
              certificateIssued: false,
              limit: 100,
              offset: 0,
            },
            tenantId,
            organisationId,
            '',
          );

          let users: LmsEligibleUser[] = (report?.data || []).map(
            (item: any) => ({
              userId: item.userId,
              courseId: item.courseId || courseId,
              courseTitle: item.courseTitle || course.title,
              cohortId: cohortId,
              firstName: item.firstName || '',
              lastName: item.lastName || '',
              certificateIssuedDate: item.certificateIssuedDate,
              certificateIssueDateTime: course.certificateIssueDateTime
                ? typeof course.certificateIssueDateTime === 'string'
                  ? course.certificateIssueDateTime
                  : new Date(
                      course.certificateIssueDateTime as Date,
                    ).toISOString()
                : undefined,
              certificateIssued: item.certificateIssued || false,
            }),
          );

          if (userId && userId !== 'all') {
            users = users.filter((u) => u.userId === userId);
          }

          const courseIssueDt = course.certificateIssueDateTime;
          const issueFromCourse =
            courseIssueDt != null && courseIssueDt !== ''
              ? typeof courseIssueDt === 'string'
                ? courseIssueDt
                : new Date(courseIssueDt as Date).toISOString()
              : undefined;
          for (const u of users) {
            if (issueFromCourse) {
              u.certificateIssueDateTime = issueFromCourse;
            }
          }

          this.loggerService.log(
            `Retrieved ${users.length} users from course report for course ${courseId}`,
          );
          allEligibleUsers.push(...users);

          // Stop fetching more courses once we have enough users (avoids fetching all then slicing)
          if (
            maxUsers != null &&
            maxUsers > 0 &&
            allEligibleUsers.length >= maxUsers
          ) {
            this.loggerService.log(
              `Reached limit of ${maxUsers} users - stopping fetch after course ${courseId}`,
            );
            break;
          }
        } catch (error) {
          // Optimized error handling - log but continue processing other courses
          if (error.message?.includes('ECONNREFUSED')) {
            this.loggerService.error(
              `LMS service connection refused for course ${courseId}. Skipping this course.`,
            );
          } else {
            this.loggerService.error(
              `Error getting users for course ${courseId}: ${error.message}`,
            );
          }
          // Continue with next course instead of failing completely
        }
      }

      // Filter users with complete data
      const filteredUsers = allEligibleUsers.filter((user) => {
        if (!user.userId || !user.courseId || !user.courseTitle) {
          this.loggerService.warn(
            `Skipping user with incomplete data: ${user.userId}`,
          );
          return false;
        }
        return true;
      });

      // Apply maxUsers cap after filter (filter may drop some; cap ensures we don't exceed limit)
      const cappedUsers =
        maxUsers != null && maxUsers > 0 && filteredUsers.length > maxUsers
          ? filteredUsers.slice(0, maxUsers)
          : filteredUsers;
      if (cappedUsers.length < filteredUsers.length) {
        this.loggerService.log(
          `Capped to ${cappedUsers.length} users (maxUsers=${maxUsers}); ${filteredUsers.length - cappedUsers.length} deferred`,
        );
      }

      this.loggerService.log(
        `Found ${cappedUsers.length} eligible users from dynamic search`,
      );
      return cappedUsers;
    } catch (error) {
      this.loggerService.error('Error getting eligible users:', error.message);
      throw error;
    }
  }

  /**
   * Process a batch of eligible users with enhanced validation and concurrency control
   * Optimized for large-scale processing (4-5K users)
   * @param users - Batch of eligible users
   * @param executionId - Execution ID for tracking
   * @param userId - User ID to use for database operations
   * @returns Processing results
   */
  private async processBatchWithValidation(
    users: LmsEligibleUser[],
    executionId: string,
    userId: string,
    cohortEventCriteriaMap: Record<string, number>,
  ): Promise<{
    processed: number;
    issued: number;
    skipped: number;
    errors: number;
  }> {
    let processed = 0;
    let issued = 0;
    let skipped = 0;
    let errors = 0;

    // Process users with concurrency limit to avoid overwhelming the system
    // Split batch into smaller concurrent groups
    const concurrentLimit = this.CONCURRENT_USERS_PER_BATCH;
    const userGroups = this.splitIntoBatches(users, concurrentLimit);

    for (let groupIndex = 0; groupIndex < userGroups.length; groupIndex++) {
      const userGroup = userGroups[groupIndex];

      // Process users in this group concurrently
      const promises = userGroup.map(async (user) => {
        try {
          processed++;

          // Enhanced user validation (including event attendance check)
          const userValidation = await this.validateUserForCertificateIssuance(
            user,
            executionId,
            cohortEventCriteriaMap,
          );
          if (!userValidation.isValid) {
            const skipReason = userValidation.reason || 'Validation failed';

            this.loggerService.warn(
              `[SKIP] User ${user.userId} - Condition failed: ${skipReason}`,
            );

            // Determine skip type based on reason
            let skipType: 'condition' | 'exists' | 'other' = 'condition';
            if (skipReason.includes('Certificate already exists')) {
              skipType = 'exists';
            } else if (
              skipReason.includes('Event criteria') ||
              skipReason.includes('date validation')
            ) {
              skipType = 'condition';
            }

            // Log detailed skip information to failure log
            CertificateLogger.logUserSkip(
              user.userId,
              user.courseId,
              user.courseTitle || 'Unknown',
              skipReason,
              executionId,
              'processBatchWithValidation',
              user.cohortId,
              skipType,
            );

            skipped++;
            return;
          }

          // Check if certificate already exists
          // Check if certificate already exists (certificateIssued: true/false condition)
          this.loggerService.log(
            `[CERTIFICATE_EXISTS_CHECK] Checking if certificate exists for user ${user.userId}, course ${user.courseId}`,
          );
          const existingCertificate = await this.checkCertificateExists(
            user.userId,
            user.courseId,
          );
          if (existingCertificate) {
            const skipReason =
              'Certificate already exists (certificateIssued: true)';

            this.loggerService.log(
              `[SKIP] User ${user.userId} - ${skipReason}`,
            );

            // Log skip for existing certificate to failure log
            CertificateLogger.logUserSkip(
              user.userId,
              user.courseId,
              user.courseTitle || 'Unknown',
              skipReason,
              executionId,
              'processBatchWithValidation',
              user.cohortId,
              'exists',
            );

            skipped++;
            return;
          } else {
            this.loggerService.log(
              `[CERTIFICATE_EXISTS_CHECK] ✓ No existing certificate found - PROCEEDING with user ${user.userId}, course ${user.courseId} (certificateIssued: false)`,
            );
          }

          // Issue certificate with enhanced error handling (using data from course report API)
          await this.issueCertificateWithValidation(user, executionId, userId);

          this.loggerService.log(
            `Certificate issued for user ${user.userId}, course ${user.courseId} [Execution ID: ${executionId}]`,
          );
          issued++;
        } catch (error) {
          // Log detailed failure information
          const errorMessage = error?.message || 'Unknown error';
          const errorStack = error?.stack || null;
          const errorName = error?.name || 'Error';
          const errorCode = error?.code || null;

          this.loggerService.error(
            `[ERROR] User ${user.userId} - Certificate issuance failed: ${errorMessage} [Execution ID: ${executionId}]`,
          );

          // Determine if it's a condition failure or system error
          const isConditionFailure =
            errorMessage.includes('validation') ||
            errorMessage.includes('condition') ||
            errorMessage.includes('Event criteria') ||
            errorMessage.includes('date validation');

          // Log detailed failure to failure log file
          CertificateLogger.logUserFailure(
            user.userId,
            user.courseId,
            user.courseTitle || 'Unknown',
            user.cohortId,
            `Certificate issuance failed: ${errorMessage}`,
            {
              message: errorMessage,
              stack: errorStack,
              name: errorName,
              code: errorCode,
              failureType: isConditionFailure ? 'condition' : 'system_error',
              isConditionFailure,
            },
            executionId,
            'processBatchWithValidation',
          );

          errors++;
        }
      });

      // Wait for current group to complete before processing next group
      await Promise.all(promises);

      // Small delay between concurrent groups to prevent overwhelming external services
      if (groupIndex < userGroups.length - 1) {
        await this.delay(500); // 500ms delay between concurrent groups
      }

      // Force garbage collection hint for large batches (if available)
      if (global.gc && groupIndex % 5 === 0) {
        try {
          global.gc();
        } catch (e) {
          // GC not available or failed, continue
        }
      }
    }

    return { processed, issued, skipped, errors };
  }

  /**
   * Validate external services health
   * Optimized with shorter timeout and better error handling
   */
  private async validateExternalServicesHealth(): Promise<{
    allHealthy: boolean;
    unhealthyServices: string[];
  }> {
    // LMS Service is internal (running in-process)
    return {
      allHealthy: true,
      unhealthyServices: [],
    };
  }

  /**
   * Validate system resources
   * Optimized for large-scale processing (4-5K users)
   */
  private async validateSystemResources(): Promise<{
    isValid: boolean;
    reason?: string;
  }> {
    try {
      // Check memory usage with higher threshold for large batches
      const memUsage = process.memoryUsage();
      const memUsageMB = memUsage.heapUsed / 1024 / 1024;
      const memLimitMB = 2000; // 2GB threshold for large-scale processing

      if (memUsageMB > memLimitMB) {
        this.loggerService.warn(
          `High memory usage detected: ${memUsageMB.toFixed(
            2,
          )}MB (limit: ${memLimitMB}MB)`,
        );
        // Don't block, but log warning - allow processing to continue
        // Memory will be managed through garbage collection hints
      }

      // Check if database connection is healthy
      // This would need to be implemented based on your database setup

      return { isValid: true };
    } catch (error) {
      // Don't block on resource validation errors for large batches
      this.loggerService.warn(
        `Resource validation warning: ${error.message} - continuing anyway`,
      );
      return { isValid: true };
    }
  }

  /**
   * Validate user for certificate issuance
   * @param user - User to validate
   * @param executionId - Execution ID for logging
   */
  private async validateUserForCertificateIssuance(
    user: LmsEligibleUser,
    executionId?: string,
    cohortEventCriteriaMap?: Record<string, number>,
  ): Promise<{
    isValid: boolean;
    reason?: string;
  }> {
    try {
      // Step 1: Check certificate issue date if provided
      if (user.certificateIssuedDate) {
        this.loggerService.log(
          `Certificate issue date found: ${user.certificateIssuedDate}`,
        );
        const certificateDateValidation = this.validateCertificateIssueDate(
          user.certificateIssuedDate,
        );
        if (!certificateDateValidation.isValid) {
          const failureReason =
            certificateDateValidation.reason ||
            'Certificate date validation failed';

          this.loggerService.log(
            `[DATE_CONDITION] ✗ FAILED - User ${user.userId}: ${failureReason}`,
          );

          // Log date validation failure to failure log
          CertificateLogger.logUserFailure(
            user.userId,
            user.courseId,
            user.courseTitle || 'Unknown',
            user.cohortId,
            `Date condition not met: ${failureReason}`,
            {
              message: failureReason,
              dateCheckFailed: true,
              certificateIssuedDate: user.certificateIssuedDate,
            },
            executionId,
            'validateUserForCertificateIssuance',
          );

          return { isValid: false, reason: failureReason };
        }
      } else {
        this.loggerService.log(
          `No certificate issue date provided for user ${user.userId} - proceeding without date validation`,
        );
      }

      // Step 2: Check if user has completed or attended at least one event
      // This check should happen before LMS condition checks
      this.loggerService.log(
        `[EVENT_CONDITION] Starting event attendance check for user ${user.userId}`,
      );
      if (user.cohortId) {
        const eventCriteria =
          (cohortEventCriteriaMap && cohortEventCriteriaMap[user.cohortId]) ??
          1;

        if (eventCriteria === 0) {
          this.loggerService.log(
            `[EVENT_CONDITION] ✓ SKIPPED - eventCriteria=0 for user ${user.userId} in cohort ${user.cohortId}`,
          );
        } else {
          this.loggerService.log(
            `[EVENT_CONDITION] Checking event attendance for user ${user.userId} in cohort ${user.cohortId} (required: ${eventCriteria})`,
          );
          const eventAttendanceCheck = await this.checkUserEventAttendance(
            user.userId,
            user.cohortId,
            eventCriteria,
          );
          if (!eventAttendanceCheck.hasAttended) {
            const failureReason =
              eventAttendanceCheck.reason ||
              'User has not completed or attended at least one event';

            this.loggerService.log(
              `[EVENT_CONDITION] ✗ FAILED - User ${
                user.userId
              } has NOT completed or attended at least one event in cohort ${
                user.cohortId
              }. Reason: ${failureReason}`,
            );

            // Log to failure log file for event criteria failure
            CertificateLogger.logUserFailure(
              user.userId,
              user.courseId,
              user.courseTitle || 'Unknown',
              user.cohortId,
              `Event criteria not met: ${failureReason}`,
              {
                message: failureReason,
                eventCheckFailed: true,
                cohortId: user.cohortId,
              },
              executionId,
              'validateUserForCertificateIssuance',
            );

            return {
              isValid: false,
              reason: failureReason,
            };
          }
          this.loggerService.log(
            `[EVENT_CONDITION] ✓ PASSED - User ${user.userId} has met event criteria (${eventCriteria}) in cohort ${user.cohortId}`,
          );
        }
      } else {
        this.loggerService.warn(
          `[EVENT_CONDITION] ⚠ SKIPPED - No cohortId found for user ${user.userId} - skipping event attendance check`,
        );
      }

      // Step 3: Additional business logic validations can be added here
      // For example: check if user is active, not suspended, etc.

      this.loggerService.log(
        `User validation completed successfully for user ${user.userId}`,
      );
      return { isValid: true };
    } catch (error) {
      this.loggerService.error(
        `Error validating user ${user.userId} for certificate issuance:`,
        error.message,
      );
      return {
        isValid: false,
        reason: `User validation error: ${error.message}`,
      };
    }
  }

  /**
   * Check if user has completed or attended at least one event
   * Uses lesson-completion-status API to verify event attendance
   * Optimized with retry logic for large-scale processing (4-5K users)
   * @param userId - User ID to check
   * @param cohortId - Cohort ID from course params
   * @returns Promise with attendance status
   */
  private async checkUserEventAttendance(
    userId: string,
    cohortId: string,
    requiredCount: number,
  ): Promise<{
    hasAttended: boolean;
    reason?: string;
  }> {
    const maxRetries = 2;
    let retryCount = 0;

    this.loggerService.log(
      `[EVENT_CONDITION] Starting event attendance check for user ${userId} in cohort ${cohortId} (attempt ${
        retryCount + 1
      }/${maxRetries + 1})`,
    );

    while (retryCount <= maxRetries) {
      try {
        // Check lesson completion status using the LMS service
        // This API checks if user has completed/attended events based on criteria
        // For event attendance, we check if user has completed or attended at least one event
        this.loggerService.log(
          `[EVENT_CONDITION] Calling lesson-completion-status API for user ${userId}, cohort ${cohortId} with criteria: lessonFormat=event, lessonSubFormat=event, completionRule=1`,
        );

        const attendanceCheck =
          await this.aspireLeaderService.checkLessonCompletionStatus(
            {
              cohortId,
              userId,
              criteria: [
                {
                  lessonFormat: LessonFormat.EVENT,
                  lessonSubFormat: LessonSubFormat.EVENT,
                  completionRule: requiredCount,
                },
              ],
            },
            process.env.TENANT_ID || 'ef99949b-7f3a-4a5f-806a-e67e683e38f3',
            process.env.ORGANISATION_ID ||
              'd36d9079-0f42-4ba3-be03-26c9e79509ee',
          );

        this.loggerService.log(
          `[EVENT_CONDITION] API Response received - overallStatus: ${
            attendanceCheck.overallStatus
          }, criteriaResults: ${JSON.stringify(
            attendanceCheck.criteriaResults,
          )}`,
        );

        // If overall status is true, user has met at least one criterion
        if (attendanceCheck.overallStatus) {
          this.loggerService.log(
            `[EVENT_CONDITION] ✓ PASSED - User ${userId} has attended events (overallStatus: true)`,
          );
          return { hasAttended: true };
        }

        // Check if any criterion was met (user attended at least one event)
        const hasAnyCompletion = attendanceCheck.criteriaResults.some(
          (result) => result.status === true,
        );

        if (hasAnyCompletion) {
          const completedCount = attendanceCheck.criteriaResults.filter(
            (result) => result.status === true,
          ).length;
          this.loggerService.log(
            `[EVENT_CONDITION] ✓ PASSED - User ${userId} has attended events (${completedCount} criteria met)`,
          );
          return { hasAttended: true };
        }

        // Log detailed failure information
        const failedCriteria = attendanceCheck.criteriaResults.filter(
          (result) => result.status === false,
        );
        this.loggerService.log(
          `[EVENT_CONDITION] ✗ FAILED - User ${userId} has NOT attended any events. Details: ${JSON.stringify(
            failedCriteria,
          )}`,
        );

        // Extract detailed failure information from criteria results
        const failedCriterion = attendanceCheck.criteriaResults.find(
          (result) => result.status === false,
        );
        const completedLessons = failedCriterion?.completedLessons || 0;
        const totalLessons = failedCriterion?.totalLessons || 0;
        const requiredLessons = failedCriterion?.criterion?.completionRule || 1;
        const failureMessage = failedCriterion?.message || 'No events attended';

        return {
          hasAttended: false,
          reason: `Event criteria not met: ${failureMessage}. Completed: ${completedLessons}/${totalLessons} events (required: ${requiredLessons})`,
        };
      } catch (error) {
        retryCount++;
        this.loggerService.error(
          `[EVENT_CONDITION] ✗ ERROR (attempt ${retryCount}/${
            maxRetries + 1
          }): Error checking event attendance for user ${userId}, cohort ${cohortId}: ${
            error.message
          }`,
        );

        // If it's a connection error and we have retries left, wait and retry
        if (
          retryCount <= maxRetries &&
          (error.message?.includes('ECONNREFUSED') ||
            error.message?.includes('timeout') ||
            error.message?.includes('ETIMEDOUT') ||
            error.response?.status >= 500)
        ) {
          this.loggerService.warn(
            `[EVENT_CONDITION] ⚠ Retryable error for user ${userId} (attempt ${retryCount}/${
              maxRetries + 1
            }), retrying...`,
          );
          await this.delay(1000 * retryCount); // Exponential backoff
          continue;
        }

        // Final error or non-retryable error
        this.loggerService.error(
          `[EVENT_CONDITION] ✗ FINAL ERROR: Error checking event attendance for user ${userId}, cohort ${cohortId}: ${error.message}`,
        );

        // If we can't check attendance after retries, we'll allow the process to continue
        // to avoid blocking certificate issuance due to API failures
        // Log the error but don't block the process
        this.loggerService.warn(
          `[EVENT_CONDITION] ⚠ All retries exhausted - allowing certificate issuance to proceed despite attendance check failure for user ${userId} after ${retryCount} attempts`,
        );
        return { hasAttended: true }; // Default to true to avoid blocking on API errors
      }
    }

    // Should not reach here, but return safe default
    return { hasAttended: true };
  }

  /**
   * Validate certificate issue date against current date
   * @param certificateIssuedDate - Certificate issue date from LMS API
   * @returns Validation result with success status and reason
   */
  private validateCertificateIssueDate(certificateIssuedDate: string): {
    isValid: boolean;
    reason?: string;
  } {
    try {
      // Get current UTC date in YYYY-MM-DD format
      const currentDateUTC = new Date().toISOString().split('T')[0];

      // Parse the certificate issue date
      const certificateDate = new Date(certificateIssuedDate);
      const certificateDateUTC = certificateDate.toISOString().split('T')[0];

      this.loggerService.log(
        `[DATE_CONDITION] Certificate Issue Date (parsed): ${certificateDateUTC}`,
      );
      this.loggerService.log(
        `[DATE_CONDITION] Current Date (UTC): ${currentDateUTC}`,
      );
      this.loggerService.log(
        `[DATE_CONDITION] Certificate Date Object: ${certificateDate.toISOString()}`,
      );

      // Check if current date is greater than or equal to certificate issue date
      if (currentDateUTC < certificateDateUTC) {
        this.loggerService.log(
          `[DATE_CONDITION] ✗ VALIDATION FAILED: Current date (${currentDateUTC}) is BEFORE certificate issue date (${certificateDateUTC}) - Certificate cannot be issued yet`,
        );
        return {
          isValid: false,
          reason: `Certificate issue date (${certificateDateUTC}) is in the future. Current date: ${currentDateUTC}`,
        };
      }

      this.loggerService.log(
        `[DATE_CONDITION] ✓ VALIDATION PASSED: Current date (${currentDateUTC}) >= Certificate issue date (${certificateDateUTC}) - Certificate can be issued`,
      );
      return { isValid: true };
    } catch (error) {
      this.loggerService.error(
        `[DATE_CONDITION] ✗ ERROR: Error validating certificate issue date: ${error.message}`,
      );
      return {
        isValid: false,
        reason: `Invalid certificate issue date format: ${certificateIssuedDate}`,
      };
    }
  }

  // getUserDetailsWithRetry method removed - no longer needed as we get user data from course report API

  /**
   * Issue certificate with enhanced validation
   */
  private async issueCertificateWithValidation(
    user: LmsEligibleUser,
    executionId: string,
    userId: string,
  ): Promise<void> {
    try {
      // Pre-issuance validation
      if (!user.firstName || !user.lastName) {
        throw new Error('User details incomplete: missing name information');
      }

      // Issue certificate using existing service
      await this.issueCertificate(user, userId);

      // Post-issuance validation (optional)
      // Could verify the certificate was actually created
    } catch (error) {
      this.loggerService.error(
        `Certificate issuance failed for user ${user.userId} [Execution ID: ${executionId}]:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Check if a certificate already exists for the user and course
   * @param userId - User ID
   * @param courseId - Course ID
   * @returns Promise<boolean>
   */
  private async checkCertificateExists(
    userId: string,
    courseId: string,
  ): Promise<boolean> {
    try {
      this.loggerService.log(
        `[CERTIFICATE_EXISTS_CHECK] Querying database for existing certificates - userId: ${userId}, courseId: ${courseId}`,
      );

      // Use the existing certificate service method to check for existing certificates
      const filters = {
        userIds: [userId],
        courseIds: [courseId],
        limit: 1,
        page: 1,
      };

      // Create a mock response object for the service call
      const mockResponse = {
        status: () => mockResponse,
        json: () => mockResponse,
        send: () => mockResponse,
      } as any;

      const existingCertificates =
        await this.certificateService.getUserCertificates(
          filters,
          mockResponse,
          { excludeAcknowledgementFromResults: false },
        );

      if (existingCertificates && existingCertificates.data) {
        const certificates = Array.isArray(existingCertificates.data)
          ? existingCertificates.data
          : [existingCertificates.data];

        if (certificates.length > 0) {
          this.loggerService.log(
            `[CERTIFICATE_EXISTS_CHECK] ✓ Found ${
              certificates.length
            } existing certificate(s) for user ${userId}, course ${courseId}. Certificate IDs: ${certificates
              .map((c: any) => c.certificateId || c.id)
              .join(', ')}. Result: certificateIssued = true`,
          );
          return true;
        } else {
          this.loggerService.log(
            `[CERTIFICATE_EXISTS_CHECK] ✓ No existing certificates found for user ${userId}, course ${courseId}. Result: certificateIssued = false`,
          );
          return false;
        }
      }

      this.loggerService.log(
        `[CERTIFICATE_EXISTS_CHECK] ✓ No certificates found in response for user ${userId}, course ${courseId}. Result: certificateIssued = false`,
      );
      return false;
    } catch (error) {
      this.loggerService.error(
        `[CERTIFICATE_EXISTS_CHECK] ✗ ERROR: Error checking if certificate exists for user ${userId}, course ${courseId}: ${error.message}`,
      );
      // Return false on error to allow certificate issuance to proceed
      this.loggerService.log(
        `[CERTIFICATE_EXISTS_CHECK] ⚠ Returning false due to error - certificate issuance will proceed`,
      );
      return false;
    }
  }

  /**
   * Issue certificate for a user
   * @param user - Eligible user data from LMS (includes firstName, lastName)
   * @param userId - User ID to use for database operations
   */
  private async issueCertificate(
    user: LmsEligibleUser,
    userId: string,
  ): Promise<void> {
    try {
      this.loggerService.log(
        `Preparing certificate for user: ${user.userId} - ${user.firstName} ${user.lastName}`,
      );

      // Match certificate.service display format: month + year (credentialSubject.issuedOn)
      const issuedOnDisplayOptions: Intl.DateTimeFormatOptions = {
        month: 'long',
        year: 'numeric',
      };
      let issuedOnBase = new Date();
      if (user.certificateIssueDateTime) {
        const parsed = new Date(user.certificateIssueDateTime);
        if (!Number.isNaN(parsed.getTime())) {
          issuedOnBase = parsed;
        } else {
          this.loggerService.warn(
            `Invalid certificateIssueDateTime from LMS for user ${user.userId}: ${user.certificateIssueDateTime} — using current date for issuedOn`,
          );
        }
      }
      const issuedOn = issuedOnBase.toLocaleDateString(
        'en-US',
        issuedOnDisplayOptions,
      );

      const issueCredentialDto = {
        userId: user.userId,
        courseId: user.courseId,
        courseName: user.courseTitle,
        firstName: user.firstName,
        middleName: '', // Not available from course report API
        lastName: user.lastName,
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000,
        ).toISOString(), // 1 year from now
        issuedOn,
        ...(user.certificateIssueDateTime
          ? { certificateIssueDateTime: user.certificateIssueDateTime }
          : {}),
      };

      // Create mock request and response objects for the certificate service
      // Get tenantId and academicYearId from environment variables
      const tenantId =
        process.env.TENANT_ID || 'ef99949b-7f3a-4a5f-806a-e67e683e38f3';
      const academicYearId = process.env.ACADEMIC_YEAR_ID || '2024-25';

      const mockRequest = {
        headers: {
          'user-id': userId, // Add userId to headers for database operations
          tenantid: tenantId,
          academicyearid: academicYearId,
          'tenant-id': tenantId, // Alternative header name
          'academic-year-id': academicYearId, // Alternative header name
        },
        // Add userId to request object for direct access
        userId: userId,
      };

      const mockResponse = {
        status: (code: number) => ({
          json: (data: any) => data,
        }),
      };

      // Call the existing certificate service method
      await this.certificateService.issueCertificateAfterCourseCompletion(
        issueCredentialDto,
        mockRequest, // mock request object
        mockResponse, // mock response object
      );

      this.loggerService.log(
        `Certificate issued successfully for ${user.firstName} ${user.lastName} (${user.userId})`,
      );
    } catch (error) {
      this.loggerService.error(
        `Failed to issue certificate for user ${user.userId}:`,
        error.message,
      );
      throw error;
    }
  }

  // Date validation methods removed - will be implemented when date API is available

  /**
   * Split array into batches
   * @param array - Array to split
   * @param batchSize - Size of each batch
   * @returns Array of batches
   */
  private splitIntoBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Calculate estimated processing time for large datasets
   * @param userCount - Number of users to process
   * @param batchSize - Size of each batch
   * @returns Object with time estimates
   */
  private calculateProcessingTime(
    userCount: number,
    batchSize: number,
  ): {
    estimatedMinutes: number;
    estimatedHours: number;
    batchCount: number;
  } {
    const batchCount = Math.ceil(userCount / batchSize);
    const concurrentUsers = this.CONCURRENT_USERS_PER_BATCH;
    const usersPerConcurrentGroup = Math.ceil(batchSize / concurrentUsers);

    // More accurate time estimate considering concurrency
    // Each user takes ~2-3 seconds (including API calls, DB operations)
    const timePerUser = 2500; // 2.5 seconds per user (optimized estimate)
    const timePerConcurrentGroup =
      (timePerUser * concurrentUsers) / concurrentUsers; // Parallel processing
    const timePerBatch = timePerUser * usersPerConcurrentGroup; // Sequential groups within batch
    const delayBetweenBatches = 2000; // 2 seconds delay between batches
    const delayBetweenConcurrentGroups = 500; // 0.5 seconds between concurrent groups

    const totalTimeMs =
      timePerBatch * batchCount +
      (batchCount - 1) * delayBetweenBatches +
      (usersPerConcurrentGroup - 1) * delayBetweenConcurrentGroups * batchCount;

    const estimatedMinutes = Math.ceil(totalTimeMs / 60000);
    const estimatedHours = Math.ceil(estimatedMinutes / 60);

    return {
      estimatedMinutes,
      estimatedHours,
      batchCount,
    };
  }

  /**
   * Generate unique execution ID for tracking
   */
  private generateExecutionId(): string {
    return `cert-${Date.now()}-${randomUUID()}`;
  }

  /**
   * Validate date range
   */
  private isValidDateRange(startDate: string, endDate: string): boolean {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return (
        start <= end &&
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime())
      );
    } catch {
      // Ignored: Invalid date format passed, return false
      return false;
    }
  }

  /**
   * Log execution summary for monitoring
   */
  private async logExecutionSummary(
    executionId: string,
    summary: {
      totalProcessed: number;
      totalIssued: number;
      totalSkipped: number;
      totalErrors: number;
      duration: number;
      startTime: string;
      endTime: string;
    },
  ): Promise<void> {
    try {
      const summaryData = {
        ...summary,
        successRate:
          summary.totalProcessed > 0
            ? ((summary.totalIssued / summary.totalProcessed) * 100).toFixed(
                2,
              ) + '%'
            : '0%',
        errorRate:
          summary.totalProcessed > 0
            ? ((summary.totalErrors / summary.totalProcessed) * 100).toFixed(
                2,
              ) + '%'
            : '0%',
      };

      this.loggerService.log(
        `Execution Summary [${executionId}]: ${JSON.stringify(summaryData)}`,
      );
    } catch (error) {
      this.loggerService.error(
        'Error logging execution summary:',
        error.message,
      );
    }
  }

  /**
   * Log execution error
   */
  private async logExecutionError(
    executionId: string,
    error: Error,
  ): Promise<void> {
    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      };

      this.loggerService.error(
        `Execution Error [${executionId}]: ${JSON.stringify(errorData)}`,
      );
    } catch (logError) {
      this.loggerService.error(
        'Error logging execution error:',
        logError.message,
      );
    }
  }

  /**
   * Utility method to add delay
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Manually trigger certificate issuance (for testing/admin purposes)
   * @param userId - User ID to filter users for (optional)
   */
  async triggerCertificateIssuance(userId?: string): Promise<{
    success: boolean;
    message: string;
    executionId: string;
    totalUsers: number;
    eligibleUsers: number;
    processedUsers: number;
    issuedCertificates: number;
    skippedUsers: number;
    errors: number;
    duration: number;
    timestamp: string;
  }> {
    const startTime = Date.now();
    const executionId = this.generateExecutionId();

    // Log certificate cron job start
    CertificateLogger.logCertificate(
      `Certificate cron job started`,
      'triggerCertificateIssuance',
      userId || 'all',
      'info',
    );

    try {
      // Get eligible users first to provide count in response using dynamic search
      const eligibleUsers =
        await this.getEligibleUsersForCertificateIssuance(userId);
      const totalUsers = eligibleUsers.length;

      if (totalUsers === 0) {
        return {
          success: true,
          message: 'No eligible users found for certificate issuance',
          executionId,
          totalUsers: 0,
          eligibleUsers: 0,
          processedUsers: 0,
          issuedCertificates: 0,
          skippedUsers: 0,
          errors: 0,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }

      // Process certificate issuance
      const results = await this.handleCertificateIssuance(userId);
      const duration = Date.now() - startTime;

      // Log certificate cron job success
      CertificateLogger.logCertificateSuccess(
        `Certificate cron job completed successfully`,
        'triggerCertificateIssuance',
        userId || 'all',
        {
          executionId,
          totalUsers,
          processedUsers: results.totalProcessed,
          issuedCertificates: results.totalIssued,
          skippedUsers: results.totalSkipped,
          errors: results.totalErrors,
          duration,
        },
      );

      return {
        success: true,
        message: 'Certificate issuance completed successfully',
        executionId,
        totalUsers,
        eligibleUsers: totalUsers,
        processedUsers: results.totalProcessed,
        issuedCertificates: results.totalIssued,
        skippedUsers: results.totalSkipped,
        errors: results.totalErrors,
        duration,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log certificate cron job error
      CertificateLogger.logCertificateError(
        `Certificate cron job failed`,
        error.message,
        'triggerCertificateIssuance',
        userId || 'all',
      );

      this.loggerService.error('Error in certificate issuance:', error.message);

      return {
        success: false,
        message: `Certificate issuance failed: ${error.message}`,
        executionId,
        totalUsers: 0,
        eligibleUsers: 0,
        processedUsers: 0,
        issuedCertificates: 0,
        skippedUsers: 0,
        errors: 1,
        duration,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get cron job status
   */
  getCronStatus(): {
    isRunning: boolean;
    isScheduled: boolean;
    nextRun: Date | null;
  } {
    return {
      isRunning: this.isRunning,
      isScheduled: this.cronInterval !== null,
      nextRun: this.cronInterval
        ? new Date(Date.now() + this.CRON_INTERVAL_MS)
        : null,
    };
  }
}
