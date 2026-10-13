import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Certificate Logger Service
 * Dedicated logger for certificate cron job operations
 */
export class CertificateLogger {
  private static instance: winston.Logger;
  private static failureLogger: winston.Logger;
  private static readonly LOGS_DIR = path.join(process.cwd(), 'logs');
  private static readonly LOG_FILE_PATH = path.join(CertificateLogger.LOGS_DIR, 'cron-certificate-generation.log');
  private static readonly FAILURE_LOG_FILE_PATH = path.join(CertificateLogger.LOGS_DIR, 'cron-certificate-failures.log');

  /**
   * Ensure the logs directory exists, create it if it doesn't
   */
  private static ensureLogsDirectory(): void {
    if (!fs.existsSync(CertificateLogger.LOGS_DIR)) {
      fs.mkdirSync(CertificateLogger.LOGS_DIR, { recursive: true });
    }
  }

  /**
   * Get the certificate logger instance
   * @returns winston.Logger instance
   */
  private static getCertificateLogger(): winston.Logger {
    // Ensure logs directory exists before creating logger
    CertificateLogger.ensureLogsDirectory();
    if (!CertificateLogger.instance) {
      CertificateLogger.instance = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
          }),
          winston.format.errors({ stack: true }),
          winston.format.json()
        ),
        defaultMeta: { service: 'certificate-cron' },
        transports: [
          // Write all logs to the dedicated certificate log file
          new winston.transports.File({
            filename: CertificateLogger.LOG_FILE_PATH,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
          }),
          // Also log to console for development
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            )
          })
        ]
      });
    }
    return CertificateLogger.instance;
  }

  /**
   * Logs certificate generation information to the dedicated certificate log file
   * @param message - The log message
   * @param context - Optional context for the log
   * @param user - Optional user identifier
   * @param level - Log level (default: 'info')
   */
  static logCertificate(
    message: string,
    context?: string,
    user?: string,
    level = "info"
  ) {
    CertificateLogger.getCertificateLogger().log({
      level: level,
      message: message,
      context: context,
      user: user,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Logs certificate generation errors to the dedicated certificate log file
   * @param message - The error message
   * @param error - Optional error details
   * @param context - Optional context for the log
   * @param user - Optional user identifier
   */
  static logCertificateError(
    message: string,
    error?: string,
    context?: string,
    user?: string
  ) {
    CertificateLogger.getCertificateLogger().error({
      message: message,
      error: error,
      context: context,
      user: user,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Logs certificate generation success to the dedicated certificate log file
   * @param message - The success message
   * @param context - Optional context for the log
   * @param user - Optional user identifier
   * @param data - Optional success data
   */
  static logCertificateSuccess(
    message: string,
    context?: string,
    user?: string,
    data?: any
  ) {
    CertificateLogger.getCertificateLogger().info({
      level: 'info',
      message: message,
      context: context,
      user: user,
      data: data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Logs certificate generation warnings to the dedicated certificate log file
   * @param message - The warning message
   * @param context - Optional context for the log
   * @param user - Optional user identifier
   */
  static logCertificateWarning(
    message: string,
    context?: string,
    user?: string
  ) {
    CertificateLogger.getCertificateLogger().warn({
      level: 'warn',
      message: message,
      context: context,
      user: user,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Logs certificate generation debug information to the dedicated certificate log file
   * @param message - The debug message
   * @param context - Optional context for the log
   * @param user - Optional user identifier
   * @param data - Optional debug data
   */
  static logCertificateDebug(
    message: string,
    context?: string,
    user?: string,
    data?: any
  ) {
    CertificateLogger.getCertificateLogger().debug({
      level: 'debug',
      message: message,
      context: context,
      user: user,
      data: data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get the failure logger instance (separate file for failed users)
   * @returns winston.Logger instance for failures
   */
  private static getFailureLogger(): winston.Logger {
    // Ensure logs directory exists before creating logger
    CertificateLogger.ensureLogsDirectory();
    
    if (!CertificateLogger.failureLogger) {
      CertificateLogger.failureLogger = winston.createLogger({
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
          }),
          winston.format.errors({ stack: true }),
          winston.format.json()
        ),
        defaultMeta: { service: 'certificate-cron-failures' },
        transports: [
          // Write failures to a dedicated failure log file
          new winston.transports.File({
            filename: CertificateLogger.FAILURE_LOG_FILE_PATH,
            maxsize: 10485760, // 10MB for failure logs
            maxFiles: 10, // Keep more failure logs for analysis
            tailable: true
          }),
          // Also log to console
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            )
          })
        ]
      });
    }
    return CertificateLogger.failureLogger;
  }

  /**
   * Logs detailed failure information for a user
   * Writes to a separate failure log file for easy analysis
   * @param userId - User ID that failed
   * @param courseId - Course ID
   * @param courseTitle - Course title
   * @param cohortId - Cohort ID
   * @param failureReason - Reason for failure
   * @param errorDetails - Detailed error information
   * @param executionId - Execution ID for tracking
   * @param context - Optional context
   */
  static logUserFailure(
    userId: string,
    courseId: string,
    courseTitle: string,
    cohortId: string | undefined,
    failureReason: string,
    errorDetails?: any,
    executionId?: string,
    context?: string
  ) {
    // Determine failure type
    const failureType = errorDetails?.failureType || 
                       (errorDetails?.isConditionFailure ? 'condition' : 'system_error');
    
    const failureData = {
      userId,
      courseId,
      courseTitle,
      cohortId: cohortId || null,
      failureReason,
      failureType, // 'condition' or 'system_error'
      errorDetails: errorDetails || null,
      errorMessage: errorDetails?.message || errorDetails || null,
      errorStack: errorDetails?.stack || null,
      errorName: errorDetails?.name || null,
      errorCode: errorDetails?.code || null,
      executionId: executionId || null,
      context: context || 'certificate-issuance',
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0], // For easy filtering by date
    };

    CertificateLogger.getFailureLogger().error({
      type: 'USER_CERTIFICATE_FAILURE',
      ...failureData
    });

    // Also log to main log file for reference
    CertificateLogger.getCertificateLogger().error({
      message: `Certificate issuance failed for user: ${userId}`,
      userId,
      courseId,
      courseTitle,
      failureReason,
      executionId,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Logs detailed skip information for a user (validation failures, etc.)
   * @param userId - User ID that was skipped
   * @param courseId - Course ID
   * @param courseTitle - Course title
   * @param skipReason - Reason for skipping
   * @param cohortId - Cohort ID (optional)
   * @param executionId - Execution ID for tracking
   * @param context - Optional context
   * @param skipType - Type of skip: 'condition' (validation failed) or 'exists' (certificate already exists)
   */
  static logUserSkip(
    userId: string,
    courseId: string,
    courseTitle: string,
    skipReason: string,
    executionId?: string,
    context?: string,
    cohortId?: string,
    skipType?: 'condition' | 'exists' | 'other'
  ) {
    const skipData = {
      userId,
      courseId,
      courseTitle,
      cohortId: cohortId || null,
      skipReason,
      skipType: skipType || 'other',
      executionId: executionId || null,
      context: context || 'certificate-issuance',
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
    };

    CertificateLogger.getFailureLogger().warn({
      type: 'USER_CERTIFICATE_SKIP',
      ...skipData
    });

    // Also log to main log file for reference
    CertificateLogger.getCertificateLogger().warn({
      message: `Certificate issuance skipped for user: ${userId}`,
      userId,
      courseId,
      courseTitle,
      skipReason,
      skipType,
      executionId,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Logs execution summary to failure log for analysis
   * @param summary - Execution summary data
   */
  static logExecutionSummary(summary: {
    executionId: string;
    totalProcessed: number;
    totalIssued: number;
    totalSkipped: number;
    totalErrors: number;
    duration: number;
    startTime: string;
    endTime: string;
  }) {
    CertificateLogger.getFailureLogger().info({
      type: 'EXECUTION_SUMMARY',
      ...summary,
      successRate: summary.totalProcessed > 0 
        ? ((summary.totalIssued / summary.totalProcessed) * 100).toFixed(2) + '%' 
        : '0%',
      errorRate: summary.totalProcessed > 0 
        ? ((summary.totalErrors / summary.totalProcessed) * 100).toFixed(2) + '%' 
        : '0%',
      skipRate: summary.totalProcessed > 0 
        ? ((summary.totalSkipped / summary.totalProcessed) * 100).toFixed(2) + '%' 
        : '0%',
      timestamp: new Date().toISOString(),
    });
  }
}