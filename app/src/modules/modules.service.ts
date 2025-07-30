import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Not, IsNull } from 'typeorm';
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
import { CacheConfigService } from '../cache/cache-config.service';
import { OrderingService } from '../common/services/ordering.service';

@Injectable()
export class ModulesService {
  private readonly logger = new Logger(ModulesService.name);

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
    private readonly cacheConfig: CacheConfigService,
    private readonly orderingService: OrderingService,
  ) {
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
        throw new BadRequestException(RESPONSE_MESSAGES.ERROR.PARENT_MODULE_INVALID);
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
    else {
      // Either courseId or parentId is required
      throw new BadRequestException(RESPONSE_MESSAGES.ERROR.COURSE_OR_PARENT_REQUIRED);
    }

    // Check if a module with the same title already exists in the same context
    const existingModule = await this.moduleRepository.findOne({
      where: [
        { 
          title: createModuleDto.title, 
          courseId: createModuleDto.courseId,
          parentId: IsNull(),
          status: Not(ModuleStatus.ARCHIVED),
          tenantId,
          organisationId
        } as FindOptionsWhere<Module>,
        { 
          title: createModuleDto.title, 
          parentId: createModuleDto.parentId,
          status: Not(ModuleStatus.ARCHIVED),
          tenantId,
          organisationId
        } as FindOptionsWhere<Module>,
      ],
    });

    if (existingModule) {
      throw new ConflictException(RESPONSE_MESSAGES.ERROR.MODULE_ALREADY_EXISTS);
    }

    
    // Get next ordering if not provided
    let ordering = createModuleDto.ordering;
    if (ordering === undefined || ordering === null) {
      ordering = await this.orderingService.getNextModuleOrder(
        createModuleDto.courseId,
        createModuleDto.parentId,
        tenantId,
        organisationId
      );
    }

    // Create moduleData with only fields that exist in the entity
    const moduleData = {
      title: createModuleDto.title,
      description: createModuleDto.description,
      courseId: createModuleDto.courseId,
      parentId: createModuleDto.parentId || undefined,
      image: createModuleDto.image, 
      ordering, 
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

    // Cache the new module and invalidate related caches
    await Promise.all([
      this.cacheService.setModule(savedModule),
      this.cacheService.invalidateModule(savedModule.moduleId, savedModule.courseId, savedModule.tenantId, savedModule.organisationId),
    ]);

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
    tenantId: string,
    organisationId: string
  ): Promise<Module> {
    // Check cache first
    const cacheKey = this.cacheConfig.getModuleKey(moduleId, tenantId || '', organisationId || '');
    const cachedModule = await this.cacheService.get<Module>(cacheKey);
    if (cachedModule) {
      return cachedModule;
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

    // Cache the module with TTL
    await this.cacheService.set(cacheKey, module, this.cacheConfig.MODULE_TTL);
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
    tenantId: string,
    organisationId: string
  ): Promise<Module[]> {
    // Check cache first
    const cacheKey = this.cacheConfig.getCourseModulesKey(courseId, tenantId, organisationId);
    const cachedModules = await this.cacheService.get<Module[]>(cacheKey);
    if (cachedModules) {
      return cachedModules;
    }

    // Build where clause with required filters
    const whereClause: FindOptionsWhere<Module> = { 
      courseId, 
      parentId: IsNull(),
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
    await this.cacheService.set(cacheKey, modules, this.cacheConfig.MODULE_TTL);

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
    tenantId: string,
    organisationId: string
  ): Promise<Module[]> {
    // Check cache first
    const cacheKey = this.cacheConfig.getModuleParentKey(parentId, tenantId, organisationId);
    const cachedModules = await this.cacheService.get<Module[]>(cacheKey);
    if (cachedModules) {
      return cachedModules;
    }

    // Build where clause with required filters
    const whereClause: FindOptionsWhere<Module> = { 
      parentId,
      tenantId,
      organisationId,
      status: Not(ModuleStatus.ARCHIVED),
    };
    
    const modules = await this.moduleRepository.find({
      where: whereClause,
      order: { ordering: 'ASC' },
    });

    // Cache the modules
    await this.cacheService.set(cacheKey, modules, this.cacheConfig.MODULE_TTL);

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
    organisationId: string,
  ): Promise<Module> {
    const module = await this.findOne(moduleId, tenantId, organisationId);

      const enrichedDto = {
        ...updateModuleDto,
        updatedBy: userId,
        updatedAt: new Date(),
      };

      const updatedModule = this.moduleRepository.merge(module, enrichedDto);
      // Update the module
      const savedModule = await this.moduleRepository.save(updatedModule);

    // Update cache and invalidate related caches
    const moduleKey = this.cacheConfig.getModuleKey(savedModule.moduleId, savedModule.tenantId, savedModule.organisationId);
    await Promise.all([
      this.cacheService.set(moduleKey, savedModule, this.cacheConfig.MODULE_TTL),
      this.cacheService.invalidateModule(moduleId, module.courseId, tenantId, organisationId),
    ]);

    return savedModule;
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
    tenantId: string,
    organisationId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const module = await this.findOne(moduleId, tenantId, organisationId);
      module.status = ModuleStatus.ARCHIVED;
      module.updatedBy = userId;
      module.updatedAt = new Date();
      const savedModule = await this.moduleRepository.save(module);

    // Invalidate all related caches
    const moduleKey = this.cacheConfig.getModuleKey(moduleId, tenantId, organisationId);
    await Promise.all([
      this.cacheService.del(moduleKey),
      this.cacheService.invalidateModule(moduleId, module.courseId, tenantId, organisationId),
    ]);

    return {
      success: true,
      message: RESPONSE_MESSAGES.MODULE_DELETED || 'Module deleted successfully',
    };
  }catch (error) {
    this.logger.error(`Error removing module: ${error.message}`, error.stack);
    throw error;
  }
}
}