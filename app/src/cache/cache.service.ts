import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CacheConfigService } from './cache-config.service';
import { Course } from '../courses/entities/course.entity';
import { Module } from '../modules/entities/module.entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { UserEnrollment } from '../enrollments/entities/user-enrollment.entity';
import { ConfigService } from '@nestjs/config';
import { TenantConfigValue } from '../configuration/interfaces/tenant-config.interface';

/**
 * Course metadata interface for caching
 * Contains only cacheable metadata fields, not full course entity
 */
export interface CourseMetadata {
  courseId: string;
  tenantId: string;
  organisationId: string;
  title: string;
  alias: string;
  shortDescription?: string;
  description: string;
  image?: string;
  featured: boolean;
  free: boolean;
  status: string;
  params?: Record<string, any>;
  ordering: number;
  prerequisites?: string[];
  certificateTerm?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly cacheEnabled: boolean;
  // LMS-specific cache enable flag - controls caching for LMS service operations
  // When false, Redis is completely bypassed for LMS operations to avoid any overhead
  private readonly lmsCacheEnabled: boolean;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly cacheConfig: CacheConfigService
  ) {
    this.cacheEnabled = this.configService.get('CACHE_ENABLED') === 'true';
    // LMS_CACHE_ENABLED is the global flag that controls LMS-specific caching
    // This allows fine-grained control over caching behavior in the LMS service
    this.lmsCacheEnabled = this.configService.get('LMS_CACHE_ENABLED') === 'true';
  }

  /**
   * Get value from cache
   * @param key Cache key
   * @returns Cached value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.cacheEnabled) {
      this.logger.debug(`Cache is ${!this.cacheEnabled ? 'disabled' : 'not connected'}, skipping get for key ${key}`);
      return null;
    }

    try {
      this.logger.debug(`Attempting to get cache for key ${key}`);
      const value = await this.cacheManager.get<T>(key);
      if (value !== undefined && value !== null) {
        this.logger.debug(`Cache HIT for key ${key}`);
        return value;
      } else {
        this.logger.debug(`Cache MISS for key ${key}`);
        return null;
      }
      return value || null;
    } catch (error) {
      this.logger.error(`Error getting cache for key ${key}: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Set value in cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in seconds
   */
  async set(key: string, value: any, ttl: number): Promise<void> {
    if (!this.cacheEnabled) {
      this.logger.debug(`Cache is ${!this.cacheEnabled ? 'disabled' : 'not connected'}, skipping set for key ${key}`);
      return;
    }

    try {
      this.logger.debug(`Attempting to set cache for key ${key} with TTL ${ttl}s`);
      await this.cacheManager.set(key, value, ttl * 1000); // Convert to milliseconds
      this.logger.debug(`Successfully set cache for key ${key}`);
    } catch (error) {
      this.logger.error(`Error setting cache for key ${key}: ${error.message}`, error.stack);
    }
  }

  /**
   * Delete value from cache
   * @param key Cache key
   */
  async del(key: string): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }

    try {
      // this.logger.debug(`Deleting cache for key ${key}`);
      await this.cacheManager.del(key);
    } catch (error) {
      this.logger.error(`Error deleting cache for key ${key}: ${error.message}`);
    }
  }

  /**
   * Delete multiple values from cache using pattern
   * @param pattern Cache key pattern (supports :* wildcard at the end)
   */
  async delByPattern(pattern: string): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }

    try {
      // Get all keys from the cache store
      const store = (this.cacheManager as any).store;
      if (!store || typeof store.keys !== 'function') {
        return;
      }

      const keys = await store.keys();

      // Convert pattern to regex if it ends with :*
      const patternRegex = pattern.endsWith(':*') 
        ? new RegExp(`^${pattern.slice(0, -2)}:.*$`)
        : new RegExp(`^${pattern}$`);

      const matchingKeys = keys.filter(key => patternRegex.test(key));
      
      if (matchingKeys.length > 0) {
        this.logger.debug(`Found ${matchingKeys.length} keys matching pattern ${pattern}`);
        await Promise.all(matchingKeys.map(key => this.del(key)));
      } else {
      }
    } catch (error) {
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }

    try {
      const store = (this.cacheManager as any).store;
      if (!store || typeof store.reset !== 'function') {
        this.logger.warn('Cache store does not support reset');
        return;
      }
      await store.reset();
    } catch (error) {
      this.logger.error(`Error clearing cache: ${error.message}`);
    }
  }

  // Configuration-specific cache methods
  async getTenantConfig(tenantId: string): Promise<TenantConfigValue | null> {  
    const key = this.cacheConfig.getTenantConfigKey(tenantId);
    const value = await this.cacheManager.get<any>(key);
    if (value !== undefined && value !== null) {
      this.logger.debug(`Cache HIT for key ${key}`);
      return value;
    } else {
      this.logger.debug(`Cache MISS for key ${key}`);
      return null;
    }
  }

  async setTenantConfig(tenantId: string, config: TenantConfigValue): Promise<void> {
   
    const key = this.cacheConfig.getTenantConfigKey(tenantId);
    await this.cacheManager.set(key, config, 0);  
  
  }

  async deleteTenantConfig(tenantId: string): Promise<void> {
   
    const key = this.cacheConfig.getTenantConfigKey(tenantId);
    await this.cacheManager.del(key); 
  
  }
  // Course-specific cache methods
  async getCourse(courseId: string, tenantId: string, organisationId: string): Promise<Course | null> {
    if (!this.cacheEnabled) {
      return null;
    }
    return this.get<Course>(this.cacheConfig.getCourseKey(courseId, tenantId, organisationId));
  }

  async setCourse(course: Course): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }
    await this.set(
      this.cacheConfig.getCourseKey(course.courseId, course.tenantId, course.organisationId),
      course,
      this.cacheConfig.COURSE_TTL
    );
  }

  async invalidateCourse(courseId: string, tenantId: string, organisationId: string): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }
    // Invalidate course-specific caches
    await Promise.all([
      this.del(this.cacheConfig.getCourseKey(courseId, tenantId, organisationId)),
      this.del(this.cacheConfig.getCourseHierarchyKey(courseId, tenantId, organisationId)),
      this.delByPattern(this.cacheConfig.getCourseModulesPattern(courseId, tenantId, organisationId)),
      this.delByPattern(`${this.cacheConfig.COURSE_PREFIX}search:${tenantId}:${organisationId}:*`),
    ]);

    // Invalidate related module caches
    await this.invalidateCourseModules(courseId, tenantId, organisationId);

    // Invalidate related lesson caches
    await this.invalidateCourseLessons(courseId, tenantId, organisationId);

    // Invalidate related enrollment caches
    await this.invalidateCourseEnrollments(courseId, tenantId, organisationId);

    // Invalidate module search caches since they might filter by courseId
    await this.invalidateModuleSearchCaches(tenantId, organisationId);
  }

  async invalidateCourseModules(courseId: string, tenantId: string, organisationId: string): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }
    await this.delByPattern(this.cacheConfig.getCourseModulesPattern(courseId, tenantId, organisationId));
  }

  async invalidateCourseLessons(courseId: string, tenantId: string, organisationId: string): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }
    await this.delByPattern(`${this.cacheConfig.LESSON_PREFIX}course:${courseId}:${tenantId}:${organisationId}:*`);
  }

  async invalidateCourseEnrollments(courseId: string, tenantId: string, organisationId: string): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }
    await this.delByPattern(`${this.cacheConfig.ENROLLMENT_PREFIX}*:${courseId}:${tenantId}:${organisationId}:*`);
  }

  // Module-specific cache methods
  async getModule(moduleId: string, tenantId: string, organisationId: string): Promise<Module | null> {
    if (!this.cacheEnabled) {
      return null;
    }
    return this.get<Module>(this.cacheConfig.getModuleKey(moduleId, tenantId, organisationId));
  }

  async setModule(module: Module): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }
    await this.set(
      this.cacheConfig.getModuleKey(module.moduleId, module.tenantId, module.organisationId),
      module,
      this.cacheConfig.MODULE_TTL
    );
  }

  async invalidateModule(moduleId: string, courseId: string, tenantId: string, organisationId: string): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }
    // Invalidate module-specific caches
    await Promise.all([
      this.del(this.cacheConfig.getModuleKey(moduleId, tenantId, organisationId)),
      this.del(this.cacheConfig.getModuleHierarchyKey(moduleId, tenantId, organisationId)),
      this.delByPattern(this.cacheConfig.getModuleLessonsPattern(moduleId, tenantId, organisationId)),
    ]);

    // Invalidate module search caches for this tenant/organization
    await this.invalidateModuleSearchCaches(tenantId, organisationId);

    // Invalidate parent course caches
    await this.invalidateCourse(courseId, tenantId, organisationId);
  }

  /**
   * Invalidate all module search caches for a specific tenant/organization
   */
  private async invalidateModuleSearchCaches(tenantId: string, organisationId: string): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }
    // Invalidate all module search caches for this tenant/organization
    const searchPattern = `${this.cacheConfig.MODULE_PREFIX}search:${tenantId}:${organisationId}:*`;
    await this.delByPattern(searchPattern);
  }

  // Lesson-specific cache methods
  async getLesson(lessonId: string, tenantId: string, organisationId: string): Promise<Lesson | null> {
    if (!this.cacheEnabled) {
      return null;
    }
    return this.get<Lesson>(this.cacheConfig.getLessonKey(lessonId, tenantId, organisationId));
  }

  async setLesson(lesson: Lesson): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }
    await this.set(
      this.cacheConfig.getLessonKey(lesson.lessonId, lesson.tenantId, lesson.organisationId),
      lesson,
      this.cacheConfig.LESSON_TTL
    );
  }

  async invalidateLesson(lessonId: string, moduleId: string, courseId: string, tenantId: string, organisationId: string): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }
    // Invalidate lesson-specific caches
    await Promise.all([
      this.del(this.cacheConfig.getLessonKey(lessonId, tenantId, organisationId)),
      this.invalidateCourse(courseId, tenantId, organisationId),
      this.invalidateModule(moduleId, courseId, tenantId, organisationId),
    ]);
  }

  // Enrollment-specific cache methods
  async getEnrollment(userId: string, courseId: string, tenantId: string, organisationId: string): Promise<UserEnrollment | null> {
    if (!this.cacheEnabled) {
      return null;
    }
    return this.get<UserEnrollment>(
      this.cacheConfig.getEnrollmentKey(userId, courseId, tenantId, organisationId)
    );
  }

  async setEnrollment(enrollment: UserEnrollment): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }
    await this.set(
      this.cacheConfig.getEnrollmentKey(enrollment.userId, enrollment.courseId, enrollment.tenantId, enrollment.organisationId),
      enrollment,
      this.cacheConfig.ENROLLMENT_TTL
    );
  }

  async invalidateEnrollment(userId: string, courseId: string, tenantId: string, organisationId: string): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }
    // Invalidate enrollment-specific caches
    await Promise.all([
      this.delByPattern(`${this.cacheConfig.ENROLLMENT_PREFIX}list:${tenantId}:${organisationId}:*`),
      this.del(this.cacheConfig.getEnrollmentKey(userId, courseId, tenantId, organisationId)),
      this.delByPattern(this.cacheConfig.getEnrollmentPattern(tenantId, organisationId)),
    ]);
  }

  /**
   * Get cached course metadata
   * 
   * This method caches ONLY course metadata (title, description, image, status, ordering, 
   * prerequisites, certificateTerm) - NOT the full course entity or user-specific data.
   * 
   * Why only course metadata is cached:
   * - Course metadata is shared across users and rarely changes
   * - User-specific data (enrollments, progress) must always be fresh from DB
   * - Full course entities may contain relations that shouldn't be cached
   * 
   * IMPORTANT: This method uses LMS_CACHE_ENABLED flag, NOT CACHE_ENABLED.
   * This allows LMS-specific caching to work independently of the old cache system.
   * 
   * @param courseId Course ID
   * @param cohortId Optional cohort ID if course metadata varies per cohort
   * @returns Cached course metadata or null if not found/caching disabled
   */
  async getCourseMetaCached(courseId: string, cohortId?: string): Promise<CourseMetadata | null> {
    // When LMS_CACHE_ENABLED is false, bypass Redis completely to avoid any overhead
    // This ensures zero performance impact when caching is disabled
    if (!this.lmsCacheEnabled) {
      return null;
    }

    const cacheKey = cohortId 
      ? `course:meta:${courseId}:cohort:${cohortId}`
      : `course:meta:${courseId}`;
    
    // Use cacheManager directly to bypass cacheEnabled check
    // This allows LMS caching to work independently of CACHE_ENABLED flag
    try {
      this.logger.debug(`Attempting to get LMS cache for key ${cacheKey}`);
      const value = await this.cacheManager.get<CourseMetadata>(cacheKey);
      if (value !== undefined && value !== null) {
        this.logger.debug(`LMS Cache HIT for key ${cacheKey}`);
        return value;
      } else {
        this.logger.debug(`LMS Cache MISS for key ${cacheKey}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Error getting LMS cache for key ${cacheKey}: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Set cached course metadata
   * 
   * Stores only course metadata fields, not the full course entity.
   * TTL is configurable via LMS_COURSE_CACHE_TTL_SECONDS (default: 1800 seconds / 30 minutes).
   * 
   * IMPORTANT: This method uses LMS_CACHE_ENABLED flag, NOT CACHE_ENABLED.
   * This allows LMS-specific caching to work independently of the old cache system.
   * 
   * @param courseId Course ID
   * @param courseMeta Course metadata object (title, description, image, status, ordering, prerequisites, certificateTerm)
   * @param cohortId Optional cohort ID if course metadata varies per cohort
   */
  async setCourseMetaCached(courseId: string, courseMeta: CourseMetadata, cohortId?: string): Promise<void> {
    // When LMS_CACHE_ENABLED is false, skip Redis operations entirely
    if (!this.lmsCacheEnabled) {
      return;
    }

    const cacheKey = cohortId 
      ? `course:meta:${courseId}:cohort:${cohortId}`
      : `course:meta:${courseId}`;
    
    // Get TTL from environment variable, default to 1800 seconds (30 minutes)
    // This allows operators to adjust cache freshness based on business needs
    const ttl = Number.parseInt(
      this.configService.get('LMS_COURSE_CACHE_TTL_SECONDS') || '1800',
      10
    );

    // Use cacheManager directly to bypass cacheEnabled check
    // This allows LMS caching to work independently of CACHE_ENABLED flag
    // Cache writes are best-effort - errors won't break the request
    try {
      this.logger.debug(`Attempting to set LMS cache for key ${cacheKey} with TTL ${ttl}s`);
      await this.cacheManager.set(cacheKey, courseMeta, ttl * 1000); // Convert to milliseconds
      this.logger.debug(`Successfully set LMS cache for key ${cacheKey}`);
    } catch (error) {
      // Log cache write failure but don't break the request
      // Cache is an optimization - API should work even if Redis is down
      this.logger.warn(`Failed to cache course metadata for key ${cacheKey}: ${error.message}`);
    }
  }
} 