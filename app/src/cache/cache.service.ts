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

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly cacheEnabled: boolean;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly cacheConfig: CacheConfigService
  ) {
    this.cacheEnabled = this.configService.get('CACHE_ENABLED') === 'true';
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
} 