import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Not } from 'typeorm';
import { Module, ModuleStatus } from './entities/module.entity';
import { Course, CourseStatus } from '../courses/entities/course.entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { CourseTrack } from '../tracking/entities/course-track.entity';
import { LessonTrack } from '../tracking/entities/lesson-track.entity';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ModulesService {
  private readonly logger = new Logger(ModulesService.name);
  private readonly cache_ttl_default: number;
  private readonly cache_prefix_module: string;
  private readonly cache_prefix_course: string;
  private readonly cache_prefix_lesson: string;
  private readonly cache_enabled: boolean;

  constructor(
    @InjectRepository(Module)
    private readonly moduleRepository: Repository<Module>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(CourseTrack)
    private readonly courseTrackRepository: Repository<CourseTrack>,
    @InjectRepository(LessonTrack)
    private readonly lessonTrackRepository: Repository<LessonTrack>,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {
    this.cache_enabled = this.configService.get('CACHE_ENABLED') === true;
    this.cache_ttl_default = parseInt(this.configService.get('CACHE_TTL_DEFAULT') || '3600', 10);
    this.cache_prefix_module = this.configService.get('CACHE_MODULE_PREFIX') || 'module';
    this.cache_prefix_course = this.configService.get('CACHE_COURSE_PREFIX') || 'course';
    this.cache_prefix_lesson = this.configService.get('CACHE_LESSON_PREFIX') || 'lesson';
  }

  /**
   * Create a new module
   */
  async create(
    createModuleDto: CreateModuleDto,
    userId: string,
    tenantId: string,
    organisationId?: string
  ): Promise<Module> {
    this.logger.log(`Creating module: ${JSON.stringify(createModuleDto)}`);

    // Check if the module has both courseId and parentId
    if (createModuleDto.courseId && createModuleDto.parentId) {
      // Validate that parentId belongs to the specified course
      const parentModule = await this.moduleRepository.findOne({
        where: { 
          moduleId: createModuleDto.parentId,
          courseId: createModuleDto.courseId,
          status: Not(ModuleStatus.ARCHIVED),
          tenantId,
          ...(organisationId && { organisationId }), // conditionally add organisationId if it exists
        } as FindOptionsWhere<Module>,
      });

      if (!parentModule) {
        throw new BadRequestException('Parent module does not belong to the specified course');
      }
    } 
    else if (createModuleDto.courseId) {
      // Validate that course exists
      const course = await this.courseRepository.findOne({
        where: { 
          courseId: createModuleDto.courseId,
          status: Not(CourseStatus.ARCHIVED),
          tenantId,
          ...(organisationId && { organisationId }), // conditionally add organisationId if it exists
        } as FindOptionsWhere<Course>,
      });

      if (!course) {
        throw new NotFoundException(RESPONSE_MESSAGES.ERROR.COURSE_NOT_FOUND);
      }
    } 
    else if (createModuleDto.parentId) {
      // If only parentId is specified, get the courseId from the parent module
      const parentModule = await this.moduleRepository.findOne({
        where: { 
          moduleId: createModuleDto.parentId,
          status: Not(ModuleStatus.ARCHIVED),
          tenantId,
          ...(organisationId && { organisationId }), // conditionally add organisationId if it exists
        } as FindOptionsWhere<Module>,
      });

      if (!parentModule) {
        throw new NotFoundException(RESPONSE_MESSAGES.ERROR.MODULE_NOT_FOUND);
      }

      createModuleDto.courseId = parentModule.courseId;
    } 
    else {
      // Either courseId or parentId is required
      throw new BadRequestException('Either courseId or parentId is required');
    }

    // Check if a module with the same title already exists in the same context
    const existingModule = await this.moduleRepository.findOne({
      where: [
        { 
          title: createModuleDto.title, 
          courseId: createModuleDto.courseId,
          parentId: undefined,
          status: Not(ModuleStatus.ARCHIVED),
          tenantId,
          ...(organisationId && { organisationId }), // conditionally add organisationId if it exists
        } as FindOptionsWhere<Module>,
        { 
          title: createModuleDto.title, 
          parentId: createModuleDto.parentId,
          status: Not(ModuleStatus.ARCHIVED),
          tenantId,
          ...(organisationId && { organisationId }), // conditionally add organisationId if it exists
        } as FindOptionsWhere<Module>,
      ],
    });

    if (existingModule) {
      throw new ConflictException(RESPONSE_MESSAGES.ERROR.MODULE_ALREADY_EXISTS);
    }

    
    // Create moduleData with only fields that exist in the entity
    const moduleData = {
      title: createModuleDto.title,
      description: createModuleDto.description,
      courseId: createModuleDto.courseId,
      parentId: createModuleDto.parentId || undefined,
      image: createModuleDto.image, 
      ordering: createModuleDto.ordering || 0, 
      status: createModuleDto.status || ModuleStatus.UNPUBLISHED,
      badgeTerm: createModuleDto.badgeTerm ? { term: createModuleDto.badgeTerm } : undefined,
      params: createModuleDto.params || {}, // Map meta to params
      // Required fields
      tenantId,
      organisationId,
      createdBy: userId,
      updatedBy: userId,
    };

    // Create the module
    const module = this.moduleRepository.create(moduleData);
    const savedModule = await this.moduleRepository.save(module);

    // Handle cache operations
    if (this.cache_enabled) {
      const courseModuleCacheKey = `${this.cache_prefix_module}:course:${createModuleDto.courseId}:${tenantId}:${organisationId}`;
      const courseHierarchyCacheKey = `${this.cache_prefix_course}:hierarchy:${createModuleDto.courseId}:${tenantId}:${organisationId}`;
      const entityCacheKey = `${this.cache_prefix_module}:${savedModule.moduleId}:${tenantId}:${organisationId}`;

      // Invalidate existing caches
      await Promise.all([
        this.cacheService.del(courseModuleCacheKey),
        this.cacheService.del(courseHierarchyCacheKey)
      ]);

      // Set new cache values
      await Promise.all([
        this.cacheService.set(entityCacheKey, savedModule, this.cache_ttl_default)
      ]);

      }

    return savedModule;
  }


  /**
   * Find one module by ID
   * @param moduleId The module ID to find
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async findOne(
    moduleId: string,
    tenantId?: string,
    organisationId?: string
  ): Promise<Module> {
    const cacheKey = `${this.cache_prefix_module}:${moduleId}:${tenantId}:${organisationId}`;
    
    if (this.cache_enabled) {
      const cachedModule = await this.cacheService.get<Module>(cacheKey);
      if (cachedModule) {
        return cachedModule;
      }
    }

    // Build where clause with optional filters
    const whereClause: FindOptionsWhere<Module> = { moduleId };
    
    // Add tenant and org filters if provided
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }
    
    if (organisationId) {
      whereClause.organisationId = organisationId;
    }
    
    const module = await this.moduleRepository.findOne({
      where: whereClause,
    });

    if (!module) {
      throw new NotFoundException(RESPONSE_MESSAGES.ERROR.MODULE_NOT_FOUND);
    }

    // Cache the module if caching is enabled
    if (this.cache_enabled) {
      await this.cacheService.set(cacheKey, module, this.cache_ttl_default);
    }

    return module;
  }

  /**
   * Find modules by course ID
   * @param courseId The course ID to filter by
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async findByCourse(
    courseId: string,
    tenantId?: string,
    organisationId?: string
  ): Promise<Module[]> {
    const cacheKey = `${this.cache_prefix_module}:course:${courseId}:${tenantId}:${organisationId}`;
    
    if (this.cache_enabled) {
      const cachedModules = await this.cacheService.get<Module[]>(cacheKey);
      if (cachedModules) {
        return cachedModules;
      }
    }

    // Build where clause with required filters
    const whereClause: FindOptionsWhere<Module> = { 
      courseId, 
      parentId: undefined,
      status: Not(ModuleStatus.ARCHIVED),
    };
    
    // Add tenant and org filters if provided
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }
    
    if (organisationId) {
      whereClause.organisationId = organisationId;
    }
    
    const modules = await this.moduleRepository.find({
      where: whereClause,
      order: { ordering: 'ASC' },
    });

    // Cache the modules
    if (this.cache_enabled) {
      await this.cacheService.set(cacheKey, modules, this.cache_ttl_default);
    }

    return modules;
  }

  /**
   * Find modules by parent module ID
   * @param parentId The parent module ID to filter by
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async findByParent(
    parentId: string,
    tenantId?: string,
    organisationId?: string
  ): Promise<Module[]> {
    const cacheKey = `${this.cache_prefix_module}:parent:${parentId}:${tenantId}:${organisationId}`;
    
    if (this.cache_enabled) {
      const cachedModules = await this.cacheService.get<Module[]>(cacheKey);
      if (cachedModules) {
        return cachedModules;
      }
    }

    // Build where clause with required filters
    const whereClause: FindOptionsWhere<Module> = { 
      parentId,
      status: Not(ModuleStatus.ARCHIVED),
    };
    
    // Add tenant and org filters if provided
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }
    
    if (organisationId) {
      whereClause.organisationId = organisationId;
    }
    
    const modules = await this.moduleRepository.find({
      where: whereClause,
      order: { ordering: 'ASC' },
    });

    // Cache the modules
    if (this.cache_enabled) {
      await this.cacheService.set(cacheKey, modules, this.cache_ttl_default);
    }

    return modules;
  }

  /**
   * Update a module
   */
  async update(
    moduleId: string,
    updateModuleDto: UpdateModuleDto,
    userId: string,
    tenantId: string,
    organisationId?: string,
  ): Promise<Module> {
    try {
      // Find the module to update
      const module = await this.findOne(moduleId, tenantId, organisationId);

      // Update the module
      const updatedModule = this.moduleRepository.merge(module, updateModuleDto);
      const savedModule = await this.moduleRepository.save(updatedModule);

      if (this.cache_enabled) {
        const entityCacheKey = `${this.cache_prefix_module}:${moduleId}:${tenantId}:${organisationId}`;
        const courseModuleCacheKey = `${this.cache_prefix_module}:course:${module.courseId}:${tenantId}:${organisationId}`;
        const courseHierarchyCacheKey = `${this.cache_prefix_course}:hierarchy:${module.courseId}:${tenantId}:${organisationId}`;
        const moduleLessonCacheKey = `${this.cache_prefix_lesson}:module:${moduleId}:${tenantId}:${organisationId}`;

        // Invalidate existing caches
        await Promise.all([
          this.cacheService.del(entityCacheKey),
          this.cacheService.del(courseModuleCacheKey),
          this.cacheService.del(courseHierarchyCacheKey),
          this.cacheService.del(moduleLessonCacheKey)
        ]);

        // Set new cache values
        await Promise.all([
          this.cacheService.set(entityCacheKey, savedModule, this.cache_ttl_default)
        ]);
      }

      return savedModule;
    } catch (error) {
      this.logger.error(`Error updating module: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Check if setting parentId for moduleId would create a circular reference
   */
  async wouldCreateCircularReference(moduleId: string, parentId: string): Promise<boolean> {
    // Base case: if parent is the same as module, it's a circular reference
    if (moduleId === parentId) {
      return true;
    }

    // Get the parent module
    const parentModule = await this.moduleRepository.findOne({
      where: { moduleId: parentId },
    });

    // If parent doesn't exist or has no parent, no circular reference
    if (!parentModule || !parentModule.parentId) {
      return false;
    }

    // Recursively check if any ancestor is the module we're checking
    return this.wouldCreateCircularReference(moduleId, parentModule.parentId);
  }

  /**
   * Remove a module (archive it)
   * @param moduleId The module ID to remove
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   */
  async remove(
    moduleId: string,
    userId: string,
    tenantId?: string,
    organisationId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const module = await this.findOne(moduleId, tenantId, organisationId);
      module.status = ModuleStatus.ARCHIVED;
      module.updatedBy = userId;
      module.updatedAt = new Date();
      const savedModule = await this.moduleRepository.save(module);

      if (this.cache_enabled) {
        const entityCacheKey = `${this.cache_prefix_module}:${moduleId}:${tenantId}:${organisationId}`;
        const courseModuleCacheKey = `${this.cache_prefix_module}:course:${module.courseId}:${tenantId}:${organisationId}`;
        const courseHierarchyCacheKey = `${this.cache_prefix_course}:hierarchy:${module.courseId}:${tenantId}:${organisationId}`;
        const moduleLessonCacheKey = `${this.cache_prefix_lesson}:module:${moduleId}:${tenantId}:${organisationId}`;

        // Invalidate existing caches
        await Promise.all([
          this.cacheService.del(entityCacheKey),
          this.cacheService.del(courseModuleCacheKey),
          this.cacheService.del(courseHierarchyCacheKey),
          this.cacheService.del(moduleLessonCacheKey)
        ]);

        // Set new cache values for archived module
        await Promise.all([
          this.cacheService.set(entityCacheKey, savedModule, this.cache_ttl_default)
        ]);
      }

      return { 
        success: true, 
        message: RESPONSE_MESSAGES.MODULE_DELETED || 'Module deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Error removing module: ${error.message}`, error.stack);
      throw error;
    }
  }
}