import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, EntityManager } from 'typeorm';
import { Course, CourseStatus } from '../../courses/entities/course.entity';
import { Module, ModuleStatus } from '../../modules/entities/module.entity';
import { Lesson, LessonStatus } from '../../lessons/entities/lesson.entity';

@Injectable()
export class OrderingService {
  private readonly logger = new Logger(OrderingService.name);

  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Module)
    private readonly moduleRepository: Repository<Module>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
  ) {}

  /**
   * Get the next ordering number for a course within organization/tenant
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   * @param queryRunner Optional QueryRunner for transactional operations
   * @returns The next ordering number
   */
  async getNextCourseOrder(
    tenantId?: string,
    organisationId?: string,
    queryRunner?: QueryRunner
  ): Promise<number> {
    const repository = queryRunner?.manager.getRepository(Course) || this.courseRepository;
    
    const queryBuilder = repository
      .createQueryBuilder('course')
      .select('MAX(course.ordering)', 'maxOrdering')
      .where('course.status = :publishedStatus', { publishedStatus: CourseStatus.PUBLISHED });

    if (tenantId) {
      queryBuilder.andWhere('course.tenantId = :tenantId', { tenantId });
    }

    if (organisationId) {
      queryBuilder.andWhere('course.organisationId = :organisationId', { organisationId });
    }

    const maxOrdering = await queryBuilder.getRawOne();
    return (maxOrdering?.maxOrdering || 0) + 1;
  }

  /**
   * Get the next ordering number for a module within a course or parent module
   * @param courseId The course ID (if creating a top-level module)
   * @param parentId The parent module ID (if creating a submodule)
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   * @param queryRunner Optional QueryRunner for transactional operations
   * @returns The next ordering number
   */
  async getNextModuleOrder(
    courseId?: string,
    parentId?: string,
    tenantId?: string,
    organisationId?: string,
    queryRunner?: QueryRunner
  ): Promise<number> {
    const repository = queryRunner?.manager.getRepository(Module) || this.moduleRepository;
    
    const queryBuilder = repository
      .createQueryBuilder('module')
      .select('MAX(module.ordering)', 'maxOrdering')
      .where('module.status = :publishedStatus', { publishedStatus: ModuleStatus.PUBLISHED });

    if (courseId) {
      queryBuilder.andWhere('module.courseId = :courseId', { courseId });
    }

    if (parentId) {
      queryBuilder.andWhere('module.parentId = :parentId', { parentId });
    } else {
      queryBuilder.andWhere('module.parentId IS NULL');
    }

    if (tenantId) {
      queryBuilder.andWhere('module.tenantId = :tenantId', { tenantId });
    }

    if (organisationId) {
      queryBuilder.andWhere('module.organisationId = :organisationId', { organisationId });
    }

    const maxOrdering = await queryBuilder.getRawOne();
    return (maxOrdering?.maxOrdering || 0) + 1;
  }

  /**
   * Get the next ordering number for a lesson within a module
   * @param moduleId The module ID
   * @param tenantId The tenant ID for data isolation
   * @param organisationId The organization ID for data isolation
   * @param queryRunner Optional QueryRunner for transactional operations
   * @returns The next ordering number
   */
  async getNextLessonOrder(
    moduleId: string,
    courseId: string,
    tenantId?: string,
    organisationId?: string,
    queryRunner?: QueryRunner
  ): Promise<number> {
    const repository = queryRunner?.manager.getRepository(Lesson) || this.lessonRepository;
    
    const queryBuilder = repository
      .createQueryBuilder('lesson')
      .select('MAX(lesson.ordering)', 'maxOrdering')
      .where('lesson.moduleId = :moduleId', { moduleId })
      .andWhere('lesson.courseId = :courseId', { courseId })
      .andWhere('lesson.status = :publishedStatus', { publishedStatus: LessonStatus.PUBLISHED });

    if (tenantId) {
      queryBuilder.andWhere('lesson.tenantId = :tenantId', { tenantId });
    }

    if (organisationId) {
      queryBuilder.andWhere('lesson.organisationId = :organisationId', { organisationId });
    }

    const maxOrdering = await queryBuilder.getRawOne();
    return (maxOrdering?.maxOrdering || 0) + 1;
  }

  /**
   * Clone ordering: if there are no non-archived siblings in the destination scope, keep the
   * source ordering; otherwise place after the last sibling (max + 1).
   */
  async resolveCloneCourseOrdering(
    originalOrdering: number,
    tenantId: string,
    organisationId: string,
    manager: EntityManager,
  ): Promise<number> {
    const repo = manager.getRepository(Course);
    const row = await repo
      .createQueryBuilder('course')
      .select('COUNT(*)', 'cnt')
      .addSelect('MAX(course.ordering)', 'maxOrd')
      .where('course.tenantId = :tenantId', { tenantId })
      .andWhere('course.organisationId = :organisationId', { organisationId })
      .andWhere('course.status != :archived', {
        archived: CourseStatus.ARCHIVED,
      })
      .getRawOne();

    const count = Number.parseInt(row?.cnt ?? '0', 10) || 0;
    if (count === 0) {
      return originalOrdering;
    }
    const maxOrd = Number.parseInt(row?.maxOrd ?? '0', 10) || 0;
    return maxOrd + 1;
  }

  async resolveCloneModuleOrdering(
    originalOrdering: number,
    newCourseId: string,
    parentId: string | null | undefined,
    tenantId: string,
    organisationId: string,
    manager: EntityManager,
  ): Promise<number> {
    const repo = manager.getRepository(Module);
    const qb = repo
      .createQueryBuilder('module')
      .select('COUNT(*)', 'cnt')
      .addSelect('MAX(module.ordering)', 'maxOrd')
      .where('module.courseId = :courseId', { courseId: newCourseId })
      .andWhere('module.tenantId = :tenantId', { tenantId })
      .andWhere('module.organisationId = :organisationId', { organisationId })
      .andWhere('module.status != :archived', {
        archived: ModuleStatus.ARCHIVED,
      });

    if (parentId) {
      qb.andWhere('module.parentId = :parentId', { parentId });
    } else {
      qb.andWhere('module.parentId IS NULL');
    }

    const row = await qb.getRawOne();
    const count = Number.parseInt(row?.cnt ?? '0', 10) || 0;
    if (count === 0) {
      return originalOrdering;
    }
    const maxOrd = Number.parseInt(row?.maxOrd ?? '0', 10) || 0;
    return maxOrd + 1;
  }

  async resolveCloneLessonOrdering(
    originalOrdering: number,
    preserveSourceOrdering: boolean,
    newModuleId: string,
    newCourseId: string,
    tenantId: string,
    organisationId: string,
    manager: EntityManager,
  ): Promise<number> {
    if (preserveSourceOrdering) {
      return originalOrdering;
    }

    const repo = manager.getRepository(Lesson);
    const row = await repo
      .createQueryBuilder('lesson')
      .select('COUNT(*)', 'cnt')
      .addSelect('MAX(lesson.ordering)', 'maxOrd')
      .where('lesson.moduleId = :moduleId', { moduleId: newModuleId })
      .andWhere('lesson.courseId = :courseId', { courseId: newCourseId })
      .andWhere('lesson.tenantId = :tenantId', { tenantId })
      .andWhere('lesson.organisationId = :organisationId', { organisationId })
      .andWhere('lesson.status != :archived', {
        archived: LessonStatus.ARCHIVED,
      })
      .getRawOne();

    const count = Number.parseInt(row?.cnt ?? '0', 10) || 0;
    if (count === 0) {
      return originalOrdering;
    }
    const maxOrd = Number.parseInt(row?.maxOrd ?? '0', 10) || 0;
    return maxOrd + 1;
  }
} 