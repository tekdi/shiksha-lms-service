import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Not, Equal, ILike } from 'typeorm';
import { Module, ModuleStatus } from './entities/module.entity';
import { Course, CourseStatus } from '../courses/entities/course.entity';
import { CourseLesson } from '../lessons/entities/course-lesson.entity';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

@Injectable()
export class ModulesService {
  private readonly logger = new Logger(ModulesService.name);

  constructor(
    @InjectRepository(Module)
    private readonly moduleRepository: Repository<Module>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(CourseLesson)
    private readonly courseLessonRepository: Repository<CourseLesson>,
  ) {}

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
    return Array.isArray(savedModule) ? savedModule[0] : savedModule;
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
    
    return this.moduleRepository.find({
      where: whereClause,
      order: { ordering: 'ASC' },
    });
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
    
    return this.moduleRepository.find({
      where: whereClause,
      order: { ordering: 'ASC' },
    });
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
    // Get existing module
    const module = await this.findOne(moduleId, tenantId, organisationId);

   
    // Map DTO properties to entity properties
    const updateData: any = {
      updatedBy: userId,
    };
    
    // Map fields that exist in both DTO and entity
    if (updateModuleDto.title !== undefined) {
      updateData.title = updateModuleDto.title;
    }
    
    if (updateModuleDto.description !== undefined) {
      updateData.description = updateModuleDto.description;
    }
    
    if (updateModuleDto.ordering !== undefined) {
      updateData.ordering = updateModuleDto.ordering;
    }
    
    if (updateModuleDto.status !== undefined) {
      updateData.status = updateModuleDto.status;
    }
    
    
    if (updateModuleDto.parentId !== undefined) {
      updateData.parentId = updateModuleDto.parentId;
    }
    
    if (updateModuleDto.badgeTerm !== undefined) {
      updateData.badgeTerm = { term: updateModuleDto.badgeTerm };
    }
    
    // Handle image field mapping
    if (updateModuleDto.image) {
      updateData.image = updateModuleDto.image;
    }
    
    if (updateModuleDto.params !== undefined) {
      updateData.params = updateModuleDto.params;
    }
    
    // Update the module
    const updatedModule = this.moduleRepository.merge(module, updateData);
    return this.moduleRepository.save(updatedModule);
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
    tenantId?: string,
    organisationId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Find the module to remove with tenant/org filtering
      const whereClause: FindOptionsWhere<Module> = { 
        moduleId, 
        status: Not(ModuleStatus.ARCHIVED)
      };
      
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

      // Check for submodules with tenant/org filtering
      const submoduleWhereClause: FindOptionsWhere<Module> = { 
        parentId: moduleId, 
        status: Not(ModuleStatus.ARCHIVED) 
      };
      
      // Add tenant and org filters if provided
      if (tenantId) {
        submoduleWhereClause.tenantId = tenantId;
      }
      
      if (organisationId) {
        submoduleWhereClause.organisationId = organisationId;
      }
      
      const submodules = await this.moduleRepository.find({
        where: submoduleWhereClause,
      });

      // Archive all submodules
      for (const submodule of submodules) {
        submodule.status = ModuleStatus.ARCHIVED;
        await this.moduleRepository.save(submodule);
      }

      // Find lessons associated with this module
      const courseLessons = await this.courseLessonRepository.find({
        where: { moduleId } as FindOptionsWhere<CourseLesson>,
      });

      // Archive the module
      module.status = ModuleStatus.ARCHIVED;
      await this.moduleRepository.save(module);

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