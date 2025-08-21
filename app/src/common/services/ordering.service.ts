import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, Not } from 'typeorm';
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
} 